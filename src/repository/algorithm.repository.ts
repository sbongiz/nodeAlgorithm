import lodash from 'lodash';
import { EntityTypeEnum } from '../enums/entityTypeEnum.enum';
import { TableEnum } from '../enums/table.enum';
import AerialwayModel from '../models/Aerialway.model';
import AerialwayPisteModel from '../models/AerialwayPiste.model';
import ANodePisteModel from '../models/ANodePiste.model';
import ANodesModel from '../models/ANodes.model';
import NodeModel from '../models/Node.model';
import NodePisteModel from '../models/NodePiste.model';
import PointModel, { IPoint } from '../models/Point.model';
import PointPisteModel from '../models/PointPiste.model';
import { PositionModelDto } from '../models/PositionModelDto';
import StationModel from '../models/Stations.model';
import StationPisteModel from '../models/StationsPiste.model';
import TracksModel from '../models/Tracks.model';
import TracksPisteModel from '../models/TracksPiste.model';


export class AlgorithmRepository {

    private stationList: any;
    private aNodeList: any;
    private aerialwayList: any;

    private nodeList: any;
    private trackList: any;
    private pointList: any;

    private pointCache = new Map<string, any>();
    private nodeCache = new Map<string, any>();
    private trackCache = new Map<string, any>();

    constructor() { }
    public updateData(nodes: any, points: any, tracks: any, aerialway: any, aNodes: any, stations: any): void {
        if (nodes != null) {
            this.nodeList.push(nodes);
        }
        if (points != null) {
            this.pointList.push(points);
        }

        if (tracks != null) {
            this.trackList.push(tracks);
        }

        if (aerialway != null) {
            this.aerialwayList.push(aerialway);
        }

        if (aNodes != null) {
            this.aNodeList.push(aNodes);
        }

        if (stations != null) {
            this.stationList.push(stations);
        }
    }

    public resetRepository() {
        this.nodeList = [];
        this.trackList = [];
        this.pointList = [];
        this.stationList = [];
        this.aNodeList = [];
        this.aerialwayList = [];
    }

    public resetData() {
            this.nodeList = [];
            this.pointList = [];
            this.trackList = [];
            this.aerialwayList = [];
            this.aNodeList = [];
            this.stationList = [];
            this.pointCache = new Map<string, any>();
            this.nodeCache = new Map<string, any>();
            this.trackCache = new Map<string, any>();
    }


    public findPointsByZone(zoneId: PositionModelDto): any {
        var points = this.pointList.find((x: any) => {
            return x.zoneId.equals(zoneId)
        })
        return points.list;
    }


    public filterTracksByPoint(point: any, zoneId: any) {
        var tracks = this.trackList.find((x: any) => {
            return x.zoneId.equals(zoneId)
        })
        return tracks.list.filter((x: any) => point.t.includes(x.i));
    }

    public findTrackById(id: any) {
        var track = this.trackCache.get(id);

        if (track == undefined) {
            for (const element of this.trackList) {
                var el = element.list.find((track: any) => track.i == id)
                if (!!el) {
                    track = el;
                    this.trackCache.set(track.i, track)
                    break;
                }
            }
        }

        return track;
    }

    public findTracksByIds(tracks: any) {
        var resultTracks = this.trackList.filter((x: { i: any; }) => tracks.includes(x.i));

        if (resultTracks.length == 0) {
            resultTracks = this.aerialwayList.filter((x: { i: any; }) => tracks.includes(x.i));
        }
        return resultTracks;
    }

    public findPointById(id: any) {
        var point = this.pointCache.get(id);

        if (point == undefined) {
            for (const element of this.pointList) {
                var el = element.list.find((point: any) => point.i == id)
                if (!!el) {
                    point = el;
                    this.pointCache.set(point.i, point);
                    break;
                }
            }
        }
        return point;
    }

    public findNodeById(id: any) {
        var node = this.nodeCache.get(id);

        if (node == undefined) {
            for (const element of this.nodeList) {
                var el = element.list.find((node: any) => node.i == id)
                if (!!el) {
                    node = el;
                    this.nodeCache.set(node.i, node);
                    break;
                }
            }
        }
        return node;
    }

    findStationsByANode(aNode: any) {

        var stationsList: any = [];
        if (aNode.s != undefined) {
            var result = this.stationList.filter((x: { i: any; }) => aNode.s.includes(x.i));
            result.forEach((element: any) => {
                stationsList.push(lodash.cloneDeep(element));
            });
            return stationsList;
        } else {
            console.log("Station not found for aNode: " + aNode.i);
        }

    }

    findAerialwayByStation(station: any) {
        var result;
        result = this.aerialwayList.filter((x: { i: any; }) => station.a.includes(x.i));

        var aerialway = lodash.cloneDeep(lodash.uniqBy(result, function (e: any) { return e.i }))
        return aerialway;
    }

    findStationsByAerialway(aerialway: any, startStationId: any) {
        var result;

        var stations = aerialway.s;

        var filteredStation = lodash.remove(aerialway.s, function (x) { return x != startStationId });

        result = this.stationList.filter((x: { i: any; }) => filteredStation.includes(x.i));

        var station = lodash.cloneDeep(result);
        return station;
    }

    findStationsById(id: any) {
        var result;
        result = this.stationList.filter((x: { i: any; }) => x.i == id);

        var station = lodash.cloneDeep(result[0]);
        station.isAerialway = true;
        return station;
    }

    findANodesByStation(station: any) {

        var aNodesList: any = [];
        var result = this.aNodeList.filter((x: { i: any; }) => station.n.includes(x.i));

        result.forEach((aNode: any) => {
            aNodesList.push(lodash.cloneDeep(aNode));
        });

        return aNodesList;
    }

    public findANodeFromId(currentANodeId: any) {
        var result;
        result = this.aNodeList.filter((x: { i: any; }) => x.i == currentANodeId);

        var connectedDistance: Map<string, string[]> = new Map(Object.entries(result[0].d));
        var connectedTrack: Map<string, string[]> = new Map(Object.entries(result[0].t));
        var aNode = lodash.cloneDeep(result[0]);
        aNode.d = connectedDistance;
        aNode.t = connectedTrack;

        return aNode;
    }

    public findANodeFromTrack(trackId: any) {
        var result;
        var aNodeList: any = [];
        result = this.aNodeList.filter((x: { t: { [s: string]: string[]; } | ArrayLike<string[]>; }) => {
            var connectedTrack: Map<string, string[]> = new Map(Object.entries(x.t));
            for (const [key, value] of connectedTrack.entries()) {
                if (value == trackId) {
                    return true
                }
            }
            return false;
        });

        result.forEach((element: { d: any; t: any }) => {
            var connectedDistance: Map<string, string[]> = new Map(Object.entries(element.d));
            var connectedTrack: Map<string, string[]> = new Map(Object.entries(element.t));
            var aNode = lodash.cloneDeep(element);
            aNode.d = connectedDistance;
            aNode.t = connectedTrack;
            aNodeList.push(aNode);
        });

        return aNodeList;
    }

    public isAnodeFromId(currentANodeId: any) {
        var result;
        result = this.aNodeList.filter((x: { i: any; }) => x.i == currentANodeId);

        if (result.length > 0) {
            return true;
        }

        return false;
    }

    public isCurrentNodeANode(currentNodeId: any) {
        var result;
        result = this.aNodeList.filter((x: { i: any; }) => x.i == currentNodeId);

        if (result.length == 0) {
            return false;
        } else {
            return true;
        }
    }

    public isNodeFromPoint(point: any) {
        var node;
        node = this.nodeList.filter((x: { i: any; }) => x.i == point.i);


        if (node.length > 0) {
            return true;
        } else {
            return false;
        }
    }

    public isNodeFromPointId(pointId: any, usePiste: any) {
        var node;
        node = this.nodeList.filter((x: { i: any; }) => x.i == pointId);

        if (usePiste && node.length == 0) {
            node = this.aNodeList.filter((x: { i: any; }) => x.i == pointId);
        }

        if (node.length > 0) {
            return true;
        } else {
            return false;
        }
    }

    public async findAllANodes() {
        var res: any = [];
        var tmpRes = await ANodesModel.find().lean();
        res.push(...tmpRes);
        return res;
    }

    public async findAllStations() {
        var res: any = [];
        var tmpRes = await StationModel.find().lean();
        res.push(...tmpRes);
        return res;
    }

    public async findAllAerialway() {
        var res: any = [];
        var tmpRes = await AerialwayModel.find().lean();
        res.push(...tmpRes);
        return res;
    }

    //PISTE
    public async findAllNodesPiste() {
        var res: any = [];
        var tmpRes = await NodePisteModel.find().lean();
        res.push(...tmpRes);
        return res;
    }

    public async findAllTracksPiste() {
        var res: any = [];
        var tmpRes = await TracksPisteModel.find().lean();
        res.push(...tmpRes);
        return res;
    }

    public async findAllPointsPiste() {
        var res: any = [];
        var tmpRes = await PointPisteModel.find().lean();
        res.push(...tmpRes);
        return res;
    }

    public async findAllANodesPiste() {
        var res: any = [];
        var tmpRes = await ANodePisteModel.find().lean();
        res.push(...tmpRes);
        return res;
    }

    public async findAllStationsPiste() {
        var res: any = [];
        var tmpRes = await StationPisteModel.find().lean();
        res.push(...tmpRes);
        return res;
    }

    public async findAllAerialwayPiste() {
        var res: any = [];
        var tmpRes = await AerialwayPisteModel.find().lean();
        res.push(...tmpRes);
        return res;
    }

    public async findAllByZoneId(entity: EntityTypeEnum, zoneId: PositionModelDto): Promise<any> {
        var res: any = [];
        if (entity == EntityTypeEnum.Points) {
            res = await PointModel.findOne({ 'x': zoneId.lng.toFixed(2), 'y': zoneId.lat.toFixed(2) }).lean();
        } else if (entity == EntityTypeEnum.Nodes) {
            res = await NodeModel.findOne({ 'x': zoneId.lng.toFixed(2), 'y': zoneId.lat.toFixed(2) }).lean();
        } else if (entity == EntityTypeEnum.Tracks) {
            res = await TracksModel.findOne({ 'x': zoneId.lng.toFixed(2), 'y': zoneId.lat.toFixed(2) }).lean();
        } else if (entity == EntityTypeEnum.ANodes) {
            res = await ANodesModel.findOne({ 'x': zoneId.lng.toFixed(2), 'y': zoneId.lat.toFixed(2) }).lean();
        } else if (entity == EntityTypeEnum.Stations) {
            res = await StationModel.findOne({ 'x': zoneId.lng.toFixed(2), 'y': zoneId.lat.toFixed(2) }).lean();
        } else if (entity == EntityTypeEnum.AerialWay) {
            res = await AerialwayModel.findOne({ 'x': zoneId.lng.toFixed(2), 'y': zoneId.lat.toFixed(2) }).lean();
        }

        if(res != null) {
            return res.l;
        } else {
            console.log("NO ZONE FOUND IN DB: " + zoneId.lng + " " + zoneId.lat);
            return [];
        }
    }
}