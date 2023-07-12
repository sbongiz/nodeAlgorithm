export class PositionModelDto {
    public lat: number;
    public lng: number;

    constructor(lat:number,lng:number) {
        this.lat = lat;
        this.lng = lng;
    }

    public equals(pos: PositionModelDto): boolean {
        if(this.lat == pos.lat && this.lng == pos.lng) {
            return true ;
        } else {
            return false;
        }
    }
}