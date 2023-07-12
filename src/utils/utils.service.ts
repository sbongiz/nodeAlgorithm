import { DbEnum } from "../enums/DbEnum";
import { HighwayEnum } from "../enums/highway.enum";
import { SurfaceEnum } from "../enums/surface.enum";
import { PositionModelDto } from "../models/PositionModelDto";

export function calculateZoneId(position: PositionModelDto ) {
    var pos = new PositionModelDto(0,0);
    try {
        if(!!position && !!position.lat && !!position.lng) {
            var latitude: string = "";
            var latSplitted = position.lat.toString().split(".");
        
            var longitude: string = "";
            var lngSplitted = position.lng.toString().split(".");
        
            if (!!latSplitted[1]) {
                var decimalValue = parseFloat("0." + latSplitted[1]);
                var decimal = decimalValue - parseFloat("0." + latSplitted[1][0]);
                if (decimal < 0.01) {
                    latitude = parseFloat(latSplitted[0]).toString();
                    latitude = latitude + "." + latSplitted[1][0] + "0";
                } else if (decimal < 0.05) {
                    latitude = parseFloat(latSplitted[0] + "." + latSplitted[1][0]).toFixed(2).toString();
                } else {
                    latitude = parseFloat(latSplitted[0] + "." + latSplitted[1][0] + "5").toString();
                }
            }
        
            if (!!lngSplitted[1]) {
                var decimalValue = parseFloat("0." + lngSplitted[1]);
                var decimal = decimalValue - parseFloat("0." + lngSplitted[1][0]);
                if (decimal < 0.01) {
                    longitude = parseFloat(lngSplitted[0]).toString();
                    longitude = longitude + "." + lngSplitted[1][0] + "0";
                } else if (decimal < 0.05) {
                    longitude = parseFloat(lngSplitted[0] + "." + lngSplitted[1][0]).toFixed(2).toString();
                } else {
                    longitude = parseFloat(lngSplitted[0] + "." + lngSplitted[1][0] + "5").toString();
                }
            }
            pos.lat = parseFloat(latitude);
            pos.lng = parseFloat(longitude);
            return pos;
        } else {
            console.error("position in undefined in method calculateZoneId [AlgorithmUtilService]");
        }     
        }
    catch(error) {
        console.error("An error occurred in method calculateZoneId [AlgorithmUtilService]: " + error);
    }
    return pos;

}


export function earthDistance(startCoordinate: any, endCoordinate: any) {
    var R = 6373.0
    var lon1 = deg2rad(startCoordinate[0]);
    var lat1 = deg2rad(startCoordinate[1]);
    if(endCoordinate.lat == undefined) {
        var lon2 = deg2rad(endCoordinate[0]);
        var lat2 = deg2rad(endCoordinate[1]);
    } else {
        var lon2 = deg2rad(endCoordinate.lng);
        var lat2 = deg2rad(endCoordinate.lat);
    }

    var dlon = lon2 - lon1;
    var dlat = lat2 - lat1;
    var a = Math.pow(Math.sin(dlat / 2), 2) + Math.cos(lat1) * Math.cos(lat2) * Math.pow(Math.sin(dlon / 2), 2);
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    var distance = R * c;
    return distance
}

export function deg2rad(deg: number) {
    return deg * (Math.PI / 180)
}

export function existProhibitions(options: { pathFilterType: string | string[]; mainActivity: any; }, track: any): boolean {
    var acceptFerrata = options.pathFilterType.includes('ferrata');

    if (!acceptFerrata) {
        return isBanned(track, options.mainActivity) || isFerrata(track)
    }
    return isBanned(track, options.mainActivity);;
}

export function isBanned(track: { p: { foot: string | string[]; highway: string | string[]; bicycle: string | string[]; }; }, activity: string) : boolean {
    //  gestire le casistiche di divieti

    if (activity == "hike") {
        if (!!track.p.foot && !!track.p.highway && (track.p.foot.length == 0 || track.p.foot.includes("yes") || track.p.foot.includes("designated") || track.p.foot.includes("permissive") || track.p.foot.includes("use_sidepath") || track.p.foot.includes("export function") || track.p.foot.includes("destination")) || track.p.highway.includes("cycleway")) {
            return false;
        } else {
            return true;
        }
    }

    if (activity == "bike") {
        if (!!track.p.bicycle && track.p.bicycle.includes("yes")) {
            return false;
        } else {
            return true;
        }
    }

    if (activity == "aerialway") {
        //Aggiungere il filtro su verso dell'impianto, se si può andare o meno in discesa barra salita
        return false;
    }
    return false;
}

export function isFerrata(track: { p: { highway: string | string[]; name: string | string[]; via_ferrata_scale: string | any[]; }; }) {
    return (!!track.p.highway && track.p.highway.includes('ferrata')) ||
        (!!track.p.highway && track.p.name.includes('ferrata')) ||
        (!!track.p.via_ferrata_scale && track.p.via_ferrata_scale.length > 0);
}

export function isPasseggino(track: { p: { highway: any[]; }; }) {
    var acceptableHighways = [HighwayEnum.Tertiary, HighwayEnum.Unclassified, HighwayEnum.Track, HighwayEnum.PrimaryLink, HighwayEnum.Secondary];
    return acceptableHighways.includes(track.p.highway[0]);
}

export function isAsfalto(track: { p: { highway: any[]; surface: string | any[]; }; }) {
    var acceptableHighways = [HighwayEnum.Primary, HighwayEnum.Secondary, HighwayEnum.Tertiary, HighwayEnum.PrimaryLink, HighwayEnum.SecondaryLink, HighwayEnum.TertiaryLink, HighwayEnum.Unclassified, HighwayEnum.Residential, HighwayEnum.Footway, , HighwayEnum.Service, HighwayEnum.Pedestrian, HighwayEnum.Cicleway, HighwayEnum.LivingStreet];
    var acceptableSurface = [SurfaceEnum.Paved, SurfaceEnum.Asphalt, SurfaceEnum.Chipseal, SurfaceEnum.Concrate, SurfaceEnum.ConcrateLanes, SurfaceEnum.ConcratePlates, SurfaceEnum.PavingStones, SurfaceEnum.Sett]
    return acceptableHighways.includes(track.p.highway[0]) || (track.p.surface.length > 0 && acceptableSurface.includes(track.p.surface[0]));
}

export function isSentiero(track: { p: { highway: any[]; surface: string | any[]; }; }) {
    var acceptableHighways = [HighwayEnum.Track, HighwayEnum.Path, HighwayEnum.Road, HighwayEnum.Bridleway];
    var acceptableSurface = [SurfaceEnum.Wood, SurfaceEnum.SteppingStones, SurfaceEnum.Unpaved, SurfaceEnum.Compacted, SurfaceEnum.FineGravel, SurfaceEnum.Gravel, SurfaceEnum.Rock, SurfaceEnum.Pebblestone, SurfaceEnum.Groung, SurfaceEnum.Grass, SurfaceEnum.GrassPaver, SurfaceEnum.Mud, SurfaceEnum.Woodchips];
    return acceptableHighways.includes(track.p.highway[0]) || (track.p.surface.length > 0 && acceptableSurface.includes(track.p.surface[0]));
}

export function colorByTrack(element: { p: { [x: string]: string; }; }, isAerialway?: any) {
    if (isAerialway) {
      return "#549685";
    }

    if (!!element.p && !!element.p["piste:difficulty"]) {
      if (element.p["piste:difficulty"] == "easy" || element.p["piste:difficulty"] == "novice") {
        return "#4465DB";
      }
      if (element.p["piste:difficulty"] == "intermediate") {
        return "#D94E5C";
      }
      if (element.p["piste:difficulty"] == "advanced" || element.p["piste:difficulty"] == "expert") {
        return "#111111";

      }
    }

    return "#4287f5";
  }

  export function getClosestKey(position: PositionModelDto, collection: any, type: DbEnum): any {
    var mindist: any = undefined;
    var closestNode: any = undefined;

    //TODO prendere points dal DB 
    if(type == DbEnum.Nodes) {
        collection.forEach((node:any) => {
            var distance = earthDistance(node.po.coordinates, position);
            if (mindist == undefined || distance < mindist) {
                closestNode = node;
                mindist = distance;
            }
    });
    } else {
        collection.forEach((point:any) => {
            var distance = earthDistance(point.c, position);
            if (mindist == undefined || distance < mindist) {
                closestNode = point;
                mindist = distance;
            }
    });
    }
    return closestNode;
}
