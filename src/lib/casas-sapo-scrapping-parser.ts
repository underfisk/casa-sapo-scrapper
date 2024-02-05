import { Page } from 'playwright';
import { extractPriceFromLocatorString } from './helpers/extractPriceFromLocatorString';
import { PropertyTypeId, PropertySubTypeId, PropertyConditionId, EquipmentId, InfrastructureId } from './types';
import type { Logger } from 'pino'

export class CasasSapoScrappingParser {
  constructor(
    private readonly page: Page,
    private readonly logger: Logger,
    private readonly assertTimeout: number
  ) { }

  private async locateTextWithDefault<T = string>({
    selector,
    defaultValue,
  }: {
    selector: string;
    // Optional: Default is null
    defaultValue?: T;
  }): Promise<string | null | T> {
    try {
      return await this.page.locator(selector).textContent({ timeout: this.assertTimeout });
    } catch {
      return defaultValue ?? null;
    }
  }

  async getSubTitle() {
    return this.locateTextWithDefault({
      selector: 'div.detail-section.detail-title > div.detail-title-location',
      defaultValue: '',
    });
  }

  async getTitle() {
    return this.locateTextWithDefault({
      selector: 'div.detail-section.detail-title > h1',
      defaultValue: '',
    });
  }

  async getPrice() {
    const value = await this.locateTextWithDefault({
      selector: 'div.detail-title-info > div.detail-title-price > div > div.detail-title-price-value',
    });

    return value ? extractPriceFromLocatorString(value) : null;
  }

  async getDescription() {
    return this.locateTextWithDefault({
      selector:
        'body > main > div.detail-main.center-content > div.detail-main-content > div.detail-section.detail-description > div.detail-description-text',
      defaultValue: '',
    });
  }

  async getAgentName() {
    return this.locateTextWithDefault({
      selector: '#detailLeadFormComponent > div.detail-form-property-owner > div > div.detail-form-property-owner-name',
    });
  }

  getPropertyTypeIds(
    adTitle: string,
    subTitle: string,
    pageUrl: string,
  ): { typeId: PropertyTypeId; subTypeId?: PropertySubTypeId } {
    // Merge both texts to a single string for a fast lookup
    const targetMergedText = `${pageUrl.toLowerCase()} ${adTitle.toLowerCase()} ${subTitle.toLowerCase()}`;

    const keywords = [
      'apartamento',
      'duplex',
      'penthouse',
      'moradia',
      'loja',
      'comercial',
      'terreno',
      'quinta',
      'quintinha',
      'herdade',
      'escritório',
      'escritorio',
      'estudio',
      'estúdio',
      'gabinete',
      'armazém',
      'armazem',
      'garagem',
      'parqueamento',
      'residencial',
      // geminada and isolada will belong to moradia so parse should be done inside
      'geminada',
      'isolada',
      // rustic/urban/misto might exist as part of "terreno" therefore
      // the parse should be done there
      'rustico',
      'rústico',
      'misto',
      'lote',
      'urbano',
      'loft',
      'sotao',
      'sótão',
      'hotel',
      'andar',
      'flat',
      'terreo',
    ];

    const matches = keywords.filter(keyword => targetMergedText.includes(keyword.toLowerCase()));
    if (matches.length === 0) {
      this.logger.warn(
        `Keywords for property type has not found anything, lookup result [${matches.toString()}], adTitle: ${adTitle}, description: ${subTitle}`,
      );
      return { typeId: PropertyTypeId.Other };
    }
    const mainMatch = matches[0];
    switch (mainMatch) {
      case 'terreo':
        return { typeId: PropertyTypeId.Plot };
      case 'flat':
        return { typeId: PropertyTypeId.Apartment };
      case 'hotel':
        return { typeId: PropertyTypeId.Building, subTypeId: PropertySubTypeId.Hotel };
      case 'loft':
      case 'sótão':
      case 'sotao':
        return { typeId: PropertyTypeId.Apartment, subTypeId: PropertySubTypeId.Loft };
      case 'duplex':
        return { typeId: PropertyTypeId.Apartment, subTypeId: PropertySubTypeId.Duplex };
      case 'penthouse':
        return { typeId: PropertyTypeId.Apartment, subTypeId: PropertySubTypeId.Penthouse };
      case 'estudio':
      case 'estúdio':
        return { typeId: PropertyTypeId.Apartment };
      case 'andar':
        return { typeId: PropertyTypeId.Apartment };
      case 'apartamento':
        // As a safeguard we can now check if there were more than 1 matches
        //e.g: ['apartamento', 'duplex']
        if (matches.includes('duplex')) {
          return { typeId: PropertyTypeId.Apartment, subTypeId: PropertySubTypeId.Duplex };
        } else if (matches.includes('penthouse')) {
          return { typeId: PropertyTypeId.Apartment, subTypeId: PropertySubTypeId.Penthouse };
        }
        return { typeId: PropertyTypeId.Apartment };
      case 'moradia':
        if (matches.includes('geminada')) {
          return { typeId: PropertyTypeId.House, subTypeId: PropertySubTypeId.SemiDetached };
        } else if (matches.includes('isolada')) {
          return { typeId: PropertyTypeId.House, subTypeId: PropertySubTypeId.Detached };
        } else if (matches.includes('duplex')) {
          return { typeId: PropertyTypeId.House, subTypeId: PropertySubTypeId.Duplex };
        }
        return { typeId: PropertyTypeId.House };
      case 'loja':
        return { typeId: PropertyTypeId.Shop };
      case 'comercial':
        return { typeId: PropertyTypeId.Building, subTypeId: PropertySubTypeId.Commercial };
      case 'lote':
        return { typeId: PropertyTypeId.Plot };
      case 'terreno':
        if (matches.includes('urbano')) {
          return { typeId: PropertyTypeId.Plot, subTypeId: PropertySubTypeId.Urban };
        } else if (matches.includes('rustico') || matches.includes('rústico')) {
          return { typeId: PropertyTypeId.Plot, subTypeId: PropertySubTypeId.Rustic };
        } else if (matches.includes('misto')) {
          return { typeId: PropertyTypeId.Plot, subTypeId: PropertySubTypeId.MixedUse };
        }
        return { typeId: PropertyTypeId.Plot };
      case 'quinta':
      case 'quintinha':
      case 'herdade':
        return { typeId: PropertyTypeId.House, subTypeId: PropertySubTypeId.Estate };
      case 'escritorio':
      case 'escritório':
      case 'gabinete':
        return { typeId: PropertyTypeId.Office };
      case 'armazem':
      case 'armazém':
        return { typeId: PropertyTypeId.Warehouse };
      case 'residencial':
        return { typeId: PropertyTypeId.Building, subTypeId: PropertySubTypeId.Residential };
      default:
        return { typeId: PropertyTypeId.Other };
    }
  }

  normalizeM2(text: string) {
    // Removes non-numeric values and parses the float value
    return parseFloat(text.replace(/[^\d.-]/g, ''));
  }

  private getConditionId(condition: string | undefined) {
    if (condition?.includes('Novo')) {
      return PropertyConditionId.New
    }
    if (condition?.includes('Em construção')) {
      return PropertyConditionId.UnderConstruction
    }

    // By default if we can't map we set the status to "Used"
    // reference: https://dev.azure.com/tagcoders/Leadmarketplace/_workitems/edit/1458
    return PropertyConditionId.Used;
  }

  async parseCoordinates() {
    const map = await this.page.locator('#objMap');
    const lat = await map.getAttribute('data-latitude');
    const long = await map.getAttribute('data-longitude');

    return { latitude: Number(lat), longitude: Number(long) };
  }

  async parseFeatures() {
    try {
      const features = await this.page.locator(
        'div.detail-section.detail-main-features > div.detail-main-features-list',
      );

      const getFeatureValue = async (hasText: string) => {
        try {
          const target = await features.locator('.detail-main-features-item', { hasText }).evaluate(div => {
            return div.querySelector('div:nth-child(2)')?.textContent;
          });
          return target ?? null;
        } catch {
          return null;
        }
      };

      // Ofc this might need formatting but it's a start
      const [condition, grossArea, usableArea, constructionYear] = await Promise.all([
        getFeatureValue('Estado'),
        getFeatureValue('Área Bruta'),
        getFeatureValue('Área Útil'),
        getFeatureValue('ANO DE CONSTRUÇÃO'),
      ]);

      // Gross should always come if not just log to debug why
      const grossAreaValue = grossArea ? this.normalizeM2(grossArea) : 0;
      const usableAreaValue = usableArea ? this.normalizeM2(usableArea) : grossAreaValue;
      const conditionId = this.getConditionId(condition)

      return {
        conditionId,
        grossArea: grossAreaValue,
        usableArea: usableAreaValue,
        constructionYear: constructionYear ? Number(constructionYear) : null,
      };
    } catch {
      return {
        // the fallback should be always used
        conditionId: PropertyConditionId.Used,
        grossArea: 0,
        usableArea: 0,
        constructionYear: null,
      };
    }
  }

  async parseImageUrls(): Promise<string[]> {
    try {
      await this.page.waitForSelector(
        '.swiper-wrapper .swiper-slide:not(.swiper-slide-duplicate)[data-swiper-slide-index] picture img',
      );

      const imageUrls = await this.page.$$eval(
        '.swiper-wrapper .swiper-slide:not(.swiper-slide-duplicate)[data-swiper-slide-index] picture img',
        images => {
          return images.map(img => {
            const src = img.getAttribute('src');
            // Some images have a base64 but the url is actually defined in another attribute
            if (src && src.includes('data:image')) {
              return img.getAttribute('data-src');
            }
            return src;
          });
        },
      );
      return imageUrls.filter(Boolean);
    } catch {
      return [];
    }
  }

  async parseEnergeticCertification(): Promise<string | null> {
    return this.locateTextWithDefault({
      selector: '.energetic-value',
      defaultValue: null,
    });
  }

  private async localeCharacteristicsTabFeatureValue(hasText: string) {
    const featureItemSelector =
      'div.detail-section.detail-features > div.detail-features-content > div.detail-features-items > div';
    try {
      return await this.page
        .locator(featureItemSelector, { hasText })
        .locator('strong')
        .textContent({ timeout: this.assertTimeout })
        .then(value => {
          // Perform a safe parse as sometimes it might come as "Não" or something else
          if (value) {
            const numeric = Number(value);
            return isNaN(numeric) ? null : numeric;
          }
          return null;
        });
    } catch {
      return null;
    }
  }

  private async locateEquipmentPresence(hasText: string) {
    const featureItemSelector =
      'div.detail-section.detail-features > div.detail-features-content > div.detail-features-items > div';
    try {
      return await this.page
        .locator(featureItemSelector, { hasText })
        .textContent({ timeout: this.assertTimeout })
        .then(value => {
          return Boolean(value);
        });
    } catch {
      return false;
    }
  }

  private async localeInfraPresence(hasText: string) {
    const featureItemSelector =
      'div.detail-section.detail-features > div.detail-features-content > div.detail-features-items > div';
    try {
      return await this.page
        .locator(featureItemSelector, { hasText })
        .textContent({ timeout: this.assertTimeout })
        .then(value => {
          return Boolean(value);
        });
    } catch {
      return false;
    }
  }

  private async ensureTabIsVisible(desiredTab: string) {
    // assert that the target tag is active otherwise we need to click
    try {
      const tab = await this.page.waitForSelector('div.detail-features-menu-content > span.active');

      const activeTab = await tab.textContent();

      if (activeTab !== desiredTab) {
        const targetTab = await this.page
          .locator(
            'div.detail-section.detail-features > div.detail-features-content > div.detail-features-menu > div > span',
            { hasText: desiredTab },
          )
          .first();

        await targetTab.click();
      }
    } catch {
      // safe to ignore
    }
  }

  async parseDivisionDetailsTab() {
    try {
      await this.ensureTabIsVisible('Divisões');

      const [bathrooms, bedrooms] = await Promise.all([
        this.localeCharacteristicsTabFeatureValue('Casa(s) de Banho'),
        this.localeCharacteristicsTabFeatureValue('Total quarto(s)'),
        // this.localeCharacteristicsTabFeatureValue('Número de pisos'),
      ]);

      return {
        bathrooms,
        bedrooms,
      };
    } catch {
      return {
        bathrooms: null,
        bedrooms: null,
      };
    }
  }

  async parseEquipmentDetailsTab(): Promise<EquipmentId[]> {
    try {
      await this.ensureTabIsVisible('Equipamentos');

      const equipmentIds: EquipmentId[] = [];
      const [hasLift, hasAirConditioner, hasCentralHeating, hasSolarPanel] = await Promise.all([
        this.locateEquipmentPresence('Elevador'),
        this.locateEquipmentPresence('Ar Condicionado'),
        this.locateEquipmentPresence('Aquecimento Central'),
        this.locateEquipmentPresence('Painéis Solares'),
      ]);

      if (hasLift) {
        equipmentIds.push(EquipmentId.Lift);
      }

      if (hasAirConditioner) {
        equipmentIds.push(EquipmentId.AirConditioner);
      }

      if (hasCentralHeating) {
        equipmentIds.push(EquipmentId.CentralHeating);
      }

      if (hasSolarPanel) {
        equipmentIds.push(EquipmentId.SolarPanel);
      }

      return equipmentIds;
    } catch {
      return [];
    }
  }

  async parseInfraDetailsTab(): Promise<InfrastructureId[]> {
    try {
      await this.ensureTabIsVisible('Infraestruturas');

      const infraIds: InfrastructureId[] = [];
      const [hasGarage, hasSwimmingPool, hasGarden, hasStorageRoom] = await Promise.all([
        this.localeInfraPresence('Garagem'),
        this.localeInfraPresence('Piscina'),
        this.localeInfraPresence('Arrecadação'),
        this.localeInfraPresence('Arrecadação'),
      ]);

      if (hasGarage) {
        infraIds.push(InfrastructureId.Garage);
      }

      if (hasSwimmingPool) {
        infraIds.push(InfrastructureId.Pool);
      }

      if (hasGarden) {
        infraIds.push(InfrastructureId.Garden);
      }

      if (hasStorageRoom) {
        infraIds.push(InfrastructureId.StorageRoom);
      }

      return infraIds;
    } catch {
      return [];
    }
  }
  async parseLocationStructure(subTitle: string) {
    try {
      const locationRawValue = await this.page
        .locator('div.detail-section.detail-map > div.detail-section-title')
        .textContent();

      const regex = /freguesia de ([^,]*)/i;
      const match = locationRawValue!.match(regex);
      const parishName = match ? match[1].trim() : null;

      const cityName = locationRawValue!.split(',')[1].trim();

      // Let's try to see if "Distrito de" is present and if so we extract
      const matches = subTitle.match(/Distrito (?:d[aeo])\s+(.+)/);
      const districtName = matches && matches[1] ? matches[1].trim() : null;

      /**
       * Context:
       * We know that district is present as "Distrito de" so we can parse it from there
       * Now the parish can be parsed from the URL if when we split through / we have more than 1
       * if not it means we have to attempt and parse it from the subTitle or just fallback to other
       */
      if (!districtName) {
        this.logger.warn(`District not found, Please check: ${this.page.url()}`);
      }

      return {
        parishName,
        cityName,
        districtName,
      };
    } catch {
      return null;
    }
  }
}
