import { createPlaywrightRouter, PlaywrightCrawler, PlaywrightCrawlerOptions, PlaywrightCrawlingContext } from 'crawlee';
import { CasasSapoScrappingParser } from './casas-sapo-scrapping-parser';
import { RegexUtils } from './helpers/RegexUtils';
import { PurchaseType, ScrappedRow } from './types';
import type { Logger } from 'pino'
import { defaultLogger } from './defaultLogger';
import { CASAS_SAPO_TARGET_CITY_URLS } from './target-urls.constants';
import { BatchingContainer } from './batching-container';

type SafePlaywrightCrawlerOptions = Omit<PlaywrightCrawlerOptions, 'preNavigationHooks' | 'launchContext' | 'requestHandler' | 'useSessionPool' | 'persistCookiesPerSession'>

type OnRowScrapped = (row: ScrappedRow) => void
type OnBatchScrapped = {
  handler: (rows: Array<ScrappedRow>) => void
  /**
   * Specifies the batch size
   * @default 50
   */
  size?: number
}

export class CasaSapoScrapper {
  // Indicates whether the routes have been initialized/setup correctly
  private initialized = false;
  private readonly router = createPlaywrightRouter();
  private readonly crawler: PlaywrightCrawler
  private parserTimeout = 1000 //1sec
  private readonly bc?: BatchingContainer

  constructor(
    private readonly onRowScrapped: OnRowScrapped | OnBatchScrapped,
    /**
     * Accepts a valid pino logger instance
     */
    private readonly logger: Logger<any> = defaultLogger,
    private readonly options?: SafePlaywrightCrawlerOptions
  ) {
    if (typeof onRowScrapped === 'object' && !!onRowScrapped['handler']) {
      const batchSize = onRowScrapped.size ?? 10
      this.bc = new BatchingContainer(batchSize, onRowScrapped.handler)
      this.logger.debug(`Batching is enabled with size: ${batchSize}`)
    }

    this.crawler = new PlaywrightCrawler({
      useSessionPool: true,
      persistCookiesPerSession: true,
      requestHandler: this.router,
      // Set the navigation timeout for 5minutes instead of 60seconds
      // If a proxy is enabled it will definitely take longer
      navigationTimeoutSecs: 60 * 5,
      // Override up to 5 minutes since it might take a while scanning
      requestHandlerTimeoutSecs: 60 * 5,
      preNavigationHooks: [
        async ({ blockRequests }) => {
          await blockRequests({
            // Using urlPatterns instead of extraUrlPatterns
            // allows to override the default which block images loading
            // We need the images to scrap otherwise it won't get any image
            // and its set as expired
            urlPatterns: [
              'gespub.casa.sapo.pt',
              'facebook.com',
              'gespub.bundle.min.css',
              'hotjar.com',
              // Block google resources
              'fonts.googleapis.com',
              'googleadservices.com',
              'google-analytics.com',
              'googletagmanager.com',
              'imoguia.com',
              'gstatic.com',
              'doubleclick.net',
            ],
          });
        },
      ],
      launchContext: {
        launchOptions: {
          // This is required for the proxy configuration as zen rows does
          // not utilize HTTPs URLs meaning that Crawler can't verify SSL
          args: ['--ignore-certificate-errors'],
        },
      },
      ...(this.options ?? {})
    });
  }

  private handleDetail = async ({ page, request }: PlaywrightCrawlingContext) => {
    const propertyId = RegexUtils.getUuidFromText(request.url);
    if (!propertyId) {
      this.logger.warn({
        message: 'Id not found',
        url: request.url
      });
      return;
    }

    const isExpired = await page
      .locator('.detail-main-content.nodetail')
      .count()
      .then(count => count > 0);

    if (isExpired) {
      this.logger.warn({
        message: 'Property expired',
        propertyId,
        url: request.url
      });
      return;
    }

    this.logger.info({
      message: 'Parsing property details',
      propertyId,
      url: request.url
    });

    // Instantiates a parser with the injected page
    const parser = new CasasSapoScrappingParser(page, this.logger, this.parserTimeout);

    const adTitle = await parser.getTitle();
    const adSubTitle = await parser.getSubTitle();
    const price = await parser.getPrice();
    const description = await parser.getDescription();
    const agentName = await parser.getAgentName();

    if (!adTitle) {
      this.logger.warn({
        message: 'Could not find the title therefore the request will be re-scheduled',
        adTitle,
        adSubTitle,
        price,
        agentName,
        url: page.url(),
      });
      throw new Error(`Could not find the title for this ad at ${page.url()}`);
    }

    if (price <= 0) {
      this.logger.warn({
        message: 'Parsed price is not a positive number',
        price,
        url: page.url(),
      });
      throw new Error(`Could not find the price for this ad at ${page.url()}`);
    }

    const imageUrls = await parser.parseImageUrls();
    const { latitude, longitude } = await parser.parseCoordinates();
    const energeticCertification = await parser.parseEnergeticCertification();

    const { conditionId, usableArea, grossArea, constructionYear } = await parser.parseFeatures();

    const purchaseTypeId = request.url.includes('comprar') ? PurchaseType.Sale : PurchaseType.Rent;

    // Fallback to description because title has less content and should be faster
    // also it is more important and accurate
    const typologyId = RegexUtils.getTypologyId([adTitle ?? '', description ?? '']);

    const { typeId: propertyTypeId, subTypeId: propertySubTypeId } = parser.getPropertyTypeIds(
      adTitle ?? '',
      adSubTitle ?? '',
      page.url(),
    );

    const { bathrooms, bedrooms } = await parser.parseDivisionDetailsTab();

    const equipments = await parser.parseEquipmentDetailsTab();

    const infra = await parser.parseInfraDetailsTab();
    const locationStructure = await parser.parseLocationStructure(adSubTitle ?? '');

    if (!locationStructure) {
      this.logger.warn({
        message: `Location structure could not be properly parsed`,
        propertyId
      });
      return;
    }

    const { cityName, districtName, parishName } = locationStructure;

    const row: ScrappedRow = {
      // Fill with the ad subtitle
      address: adSubTitle ?? null,
      agentContact: agentName ? { name: agentName } : null,
      energeticCertification,
      bathrooms,
      bedrooms,
      conditionId,
      images: imageUrls,
      divisions: null,
      equipments,
      infra,
      floor: null,
      usableArea,
      grossArea,
      latitude,
      longitude,
      price: price ?? 0,
      propertyTypeId,
      purchaseTypeId,
      propertySubTypeId,
      typologyId,
      videoUrl: null,
      zipCode: null,
      id: propertyId,
      backlinkUrl: request.url,
      title: adTitle!,
      constructionYear,
      cityName,
      parishName,
      districtName,
    };

    if (this.bc) {
      this.bc.handle(row)
    } else {
      (this.onRowScrapped as OnRowScrapped)(row)
    }
  };

  private async defaultHandler({ page, request, enqueueLinks }: PlaywrightCrawlingContext) {
    this.logger.info(`[${request.url}] Enqueueing pagination`);

    try {
      // We need the items and that's the most important I guess
      await page.waitForSelector('.list-content-properties');
      await enqueueLinks({
        selector: '.property-info-content > a',
        label: 'DETAIL',
      });

      this.logger.info(`[${request.url}] Enqueueing property details`);
      await page.waitForSelector('.pagination');

      await enqueueLinks({
        selector: '.pagination > a',
        label: 'LIST',
      });

      this.logger.info(`[${request.url}] Successfully enqueued`);
    } catch (ex) {
      // Safe to ignore which means the pagination does not exist or there are no detail items to consume
      this.logger.debug(ex)
    }
  }

  private async setupRoutes() {
    this.logger.info('[setupRoutes] Initializing routes and detail handler');
    this.router.addHandler('DETAIL', this.handleDetail);
    // This is a fallback route which will handle the start URL
    // as well as the LIST labelled URLs.
    this.router.addDefaultHandler(this.defaultHandler.bind(this));
    await this.crawler.addRequests(CASAS_SAPO_TARGET_CITY_URLS);
    this.initialized = true;
    this.logger.info('[setupRoutes] Configuration complete');
  }

  public async stop() {
    if (this.crawler.running) {
      console.log("Stopping the crawlee")
      // this.crawler.
      // TODO
    }
  }

  public setParserTimeout(value: number) {
    this.parserTimeout = value
  }

  public getCrawleeInstance() {
    return this.crawler
  }

  public async start() {
    if (!this.initialized) {
      await this.setupRoutes();
    }

    return this.crawler.run()
  }

}