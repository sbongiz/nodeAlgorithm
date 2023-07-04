export interface IGeometry {
    type: string;
    coordinates: number[] | number[][];
}

export interface IFeatures {
    type: string;
    geometry: IGeometry;
    bbox?: number[];
    properties?: any;
}

export interface IGeoJson {
    features: IFeatures;
    geometry: IGeometry;
    type: string;
}

export class GeoJson implements IGeoJson {
    constructor(public features: any, public type: any) { }
    geometry: IGeometry = this.features.geometry;
}

export class Geometry implements IGeometry {
    constructor(public type: any, public coordinates: any) {}
}