export enum EquipmentId {
    Lift = 1,
    AirConditioner = 2,
    CentralHeating = 3,
    Furnished = 4,
    EquippedKitchen = 5,
    SolarPanel = 6,
}

export enum InfrastructureId {
    Terrace = 3,
    Garage = 1,
    StorageRoom = 6,
    Pool = 7,
    Garden = 8,
    Balcony = 9,
}

// Represents the code located at Tbl_Purchase_Type
export enum PurchaseType {
    Sale = 1,
    Rent = 2,
}

export enum PropertyConditionId {
    New = 1,
    Used = 2,
    UnderConstruction = 3,
    ForRefurbish = 4,
    ToDemolish = 5,
}

export enum TypologyId {
    T0 = 0,
    T1 = 1,
    T2 = 2,
    T3 = 3,
    T4 = 4,
    T5 = 5,
    T6 = 6,
    T7 = 7,
    Other = 8,
}

export enum PropertyTypeId {
    House = 1,
    Apartment = 2,
    Plot = 3,
    Shop = 4,
    Office = 5,
    Building = 6,
    Warehouse = 7,
    Other = 10,
}

export enum PropertySubTypeId {
    NewDevelopment = 1,
    Penthouse = 2,
    Duplex = 3,
    Loft = 4,
    NewDevelopmentHouse = 5,
    SemiDetached = 6,
    Detached = 7,
    Estate = 8,
    Urban = 9,
    Buildable = 10,
    Rustic = 11,
    Residential = 12,
    MixedUse = 13,
    Commercial = 14,
    Hotel = 15,
}

export enum FloorTypeId {
    LastFloor = 1,
    MiddleFloor = 2,
    GroundFloor = 3,
}

export enum LicenseTypeId {
    Approved = 1,
    OnApproval = 2,
}

export type ScrappedRow = {
    // All the interface we need to upsert/delete in our db
    // The identifier on this platform
    id: string;
    agentContact: { name: string; phone?: string } | null;
    /**
     * Provide portuguese title, english translation will be added automatically
     */
    title: string;
    videoUrl: string | null;
    address: string | null;
    zipCode: string | null;
    parishName: string | null;
    cityName: string;
    districtName: string | null;
    floor: FloorTypeId | null;
    latitude: number;
    longitude: number;
    propertyTypeId: PropertyTypeId;
    propertySubTypeId?: PropertySubTypeId;
    conditionId: PropertyConditionId;
    purchaseTypeId: PurchaseType;
    typologyId: TypologyId;
    bedrooms: number | null;
    bathrooms: number | null;
    divisions: number | null;
    price: number;
    /**
     * If not known it will be calculated using Price / Size
     */
    priceM2?: number | null;
    /**
     * Builds ExtraFieldsJSON with it
     */
    backlinkUrl: string;
    // By default, set both equal but update will bring the right ones
    grossArea: number;
    /**
     * If known it could be provided otherwise the default is both gross and usable equal
     */
    usableArea?: number;
    /**
     * If nothing is provided a fallback image will be added
     */
    images?: string[];
    equipments: EquipmentId[];
    infra: InfrastructureId[];
    /**
     * If not provided it will be treated as InProgress
     */
    energeticCertification?: string | null;
    constructionYear?: number | null;
};
