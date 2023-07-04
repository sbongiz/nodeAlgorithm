import { isAsfalto, isBanned, isFerrata, isPasseggino, isSentiero } from "../utils/utils.service";

export class MetricsService {

    constructor() { }

    private static HIKE = "hike";
    private static BIKE = "bike";
    private static AERIALWAY = "aerialway";
    private static SKI = "ski";

    private metricConfiguration :any = { "hike": { "highway": { "path": "1", "track": "1", "footway": "1", "via_ferrata": "1", "unclassified": "1.2", "service": "2", "residential": "1", "steps": "1", "cycleway": "1", "trunk": "50", "trunk_link": "50", "primary": "8", "secondary": "4", "tertiary": "2", "motorway": "999", "motorway_link": "999", "crossing": "1", "pedestrian": "1", "bridleway": "1", "primary_link": "8", "default": "1" } }, "bike": { "highway": { "path": "15", "track": "1", "footway": "2,5", "via_ferrata": "999", "unclassified": "1", "service": "3", "residential": "1", "steps": "50", "cycleway": "0,5", "trunk": "40", "trunk_link": "40", "primary": "5", "secondary": "3", "tertiary": "2", "motorway": "999", "motorway_link": "999", "crossing": "1", "pedestrian": "1", "bridleway": "1", "primary_link": "8", "default": "30" } }, "aerialway": { "aerialway": { "path": "10", "track": "10", "footway": "10", "via_ferrata": "10", "unclassified": "12", "service": "20", "residential": "10", "steps": "10", "cycleway": "10", "trunk": "500", "trunk_link": "500", "primary": "80", "secondary": "40", "tertiary": "20", "motorway": "999", "motorway_link": "999", "crossing": "10", "pedestrian": "10", "bridleway": "10", "primary_link": "80", "default": "1" } }, "ski": { "aerialway": { "path": "10", "track": "10", "footway": "10", "via_ferrata": "10", "unclassified": "12", "service": "20", "residential": "10", "steps": "10", "cycleway": "10", "trunk": "500", "trunk_link": "500", "primary": "80", "secondary": "40", "tertiary": "20", "motorway": "999", "motorway_link": "999", "crossing": "10", "pedestrian": "10", "bridleway": "10", "primary_link": "80", "default": "1" } }  };

    public getCost(track :any, options :any, distance :any, pendenza :any) {

        //CHECK FILE METRICS IN MOMAP
        var activity = options.mainActivity;
        var acceptFerrata = options.pathFilterType.includes('ferrata') && activity == MetricsService.HIKE;
        var acceptPasseggino = options.pathFilterType.includes('passeggino') && activity == MetricsService.HIKE;
        var acceptWilderness = !!options.wilderness && activity == MetricsService.HIKE;
        var tmpCost;

        var property;

        var banned = isBanned(track, activity);
        if (banned) {
            return 999 * distance;
        }

        if (activity == MetricsService.AERIALWAY || activity == MetricsService.SKI) {
            if (!!track.p.aerialway) {
                property = track.p.aerialway[0];
            } else if (!!track.p.highway) {
                property = track.p.highway[0];
            } else {
                property = "default";
            }
        } else if (activity == MetricsService.BIKE || activity == MetricsService.HIKE) {
            property = track.p.highway[0];

        }

        if (isFerrata(track)) {
            if (acceptFerrata) {
                tmpCost = this.getMetricsFromConfiguration(track, options, pendenza, "via_ferrata");
                return tmpCost * distance;
            } else {
                return 999;
            }
        }

        if (acceptPasseggino) {
            if (isPasseggino(track)) {
                tmpCost = this.getMetricsFromConfiguration(track, options, pendenza, property);
                return (tmpCost * distance) * 10;
            } else {
                console.log("Passeggino track type: " + track.p.highway[0] + ", length: " + track.p.highway.length);
                return 999;
            }
        }

        if (acceptWilderness) {

            var wildernessDelta = options.wilderness;
            var wildernessAsphalt = parseFloat(wildernessDelta) + 0.1; // 0.1 to avoid 0 multiplicator
            var wildernessTrack = 100 - wildernessDelta + 0.1;

            tmpCost = this.getMetricsFromConfiguration(track, options, pendenza, property);
            if (isAsfalto(track)) {
                return (tmpCost * distance) * wildernessAsphalt;
            } else if (isSentiero(track)) {
                return (tmpCost * distance) * wildernessTrack;
            } else {
                return (tmpCost * distance) * 5;
            }
        }

        var tmpCost = this.getMetricsFromConfiguration(track, options, pendenza, property);
        return tmpCost * distance;
    }

    private getMetricsFromConfiguration(track :any, options: { mainActivity: string; } , pendenza :any, property :any) {

        var mainProp = "highway"
        if (options.mainActivity == MetricsService.HIKE) {
            mainProp = "highway";
        }

        if (options.mainActivity == MetricsService.AERIALWAY || options.mainActivity == MetricsService.SKI) {
            mainProp = "aerialway"
        }

        var highwayMetric = this.metricConfiguration[options.mainActivity][mainProp][property];
        if (highwayMetric == undefined || highwayMetric == null) {
            highwayMetric = this.metricConfiguration[options.mainActivity][mainProp]['default'];
        }

        return highwayMetric;
        // var piste = track.properties.piste[0];

        //funzione che estrae il costo dalla configurazione delle metriche, da track mi prendo i pathparmas [highway,aerialway, piste...], e mi uso la pendenza epr sapere quale elemento dell'array prendere
    }
}