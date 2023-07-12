export class DistanceFromStartDto {
    public id: number | undefined;
    public cost: number | undefined;
    public lat: number | undefined;
    public lng: number | undefined;

    constructor(id: any, cost: any, lat:any,lng:any) {
        this.id = id;
        this.cost = cost;
        this.lat = parseFloat(lat?.toFixed(2));
        this.lng = parseFloat(lng?.toFixed(2));
    }
}
