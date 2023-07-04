import * as lodash from 'lodash';
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

    constructor() { }
    public setRepository(nodeList: any, trackList: any, pointList: any, stationList: any, aNodeList: any, aerialwayList: any) {
        this.nodeList = nodeList;
        this.trackList = trackList;
        this.pointList = pointList;
        this.stationList = stationList;
        this.aNodeList = aNodeList;
        this.aerialwayList = aerialwayList;
    }

    public resetRepository() {
        this.nodeList = [];
        this.trackList = [];
        this.pointList = [];
        this.stationList = [];
        this.aNodeList = [];
        this.aerialwayList = [];
    }

    public filterTracksByPoint(point: any) {
        return this.trackList.filter((x: { i: any; }) => point.t.includes(x.i));
    }

    public findTrackById(trackId: any) {
        return this.trackList.find((x: { i: any; }) => x.i == trackId);
    }

    public findTracksByIds(tracks: any) {
        var resultTracks = this.trackList.filter((x: { i: any; }) => tracks.includes(x.i));

        if (resultTracks.length == 0) {
            resultTracks = this.aerialwayList.filter((x: { i: any; }) => tracks.includes(x.i));
        }
        return resultTracks;
    }

    public findPointById(pointId: any, useAerialway: any) {
        var result;
        result = this.pointList.find((x: { i: any; }) => x.i == pointId);


        if (useAerialway && result == undefined) {
            result = this.findStationsById(pointId);
        }
        return result;
    }

    public findNodeById(nodeId: any, useAerialway: any) {
        var result;

        result = this.nodeList.filter((x: { i: any; }) => x.i == nodeId);


        if (useAerialway && result.length == 0) {
            result = this.aNodeList.filter((x: { i: any; }) => x.i == nodeId);
        }

        var node = lodash.cloneDeep(result[0]);

        if (result.length > 2) {
            result = lodash.uniqWith(result, (nodeA: any, nodeB: any) => nodeA.i === nodeB.i && nodeA.x === nodeB.x && nodeA.y == nodeB.y);
        }

        if (result.length == 2) {
            node.n = lodash.union(result[0].n, result[1].n);

            var connectedDistance: Map<string, string[]> = new Map(Object.entries(result[0].d));
            var connectedTrack: Map<string, string[]> = new Map(Object.entries(result[0].t));
            var connectedDistance1: Map<string, string[]> = new Map(Object.entries(result[1].d));
            var connectedTrack1: Map<string, string[]> = new Map(Object.entries(result[1].t));

            connectedDistance1.forEach((value, key) => {
                if (!connectedDistance.has(key)) {
                    connectedDistance.set(key, value);
                }
            });

            connectedTrack1.forEach((value, key) => {
                if (!connectedTrack.has(key)) {
                    connectedTrack.set(key, value);
                }
            });

            node.d = connectedDistance;
            node.t = connectedTrack;

        } else if (result.length == 1) {
            node.d = new Map(Object.entries(result[0].d));
            node.t = new Map(Object.entries(result[0].t));
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

    public async findAllByZoneId(entity: EntityTypeEnum, zoneId: any): Promise<any> {
        var res: any = [];
        if (entity == EntityTypeEnum.Points) {
            res = await PointModel.findOne({ 'x': zoneId[0], 'y': zoneId[1] }).lean();
        } else if (entity == EntityTypeEnum.Nodes) {
            res = await NodeModel.findOne({ 'x': zoneId[0], 'y': zoneId[1] }).lean();
        } else if (entity == EntityTypeEnum.Tracks) {
            res = await TracksModel.findOne({ 'x': zoneId[0], 'y': zoneId[1] }).lean();
        } else if (entity == EntityTypeEnum.ANodes) {
            res = await ANodesModel.findOne({ 'x': zoneId[0], 'y': zoneId[1] }).lean();
        } else if (entity == EntityTypeEnum.Stations) {
            res = await StationModel.findOne({ 'x': zoneId[0], 'y': zoneId[1] }).lean();
        } else if (entity == EntityTypeEnum.AerialWay) {
            res = await AerialwayModel.findOne({ 'x': zoneId[0], 'y': zoneId[1] }).lean();
        }

        if(res != null) {
            return res.l;
        } else {
            console.log("NO ZONE FOUND IN DB: " + zoneId[0] + " " + zoneId[1]);
            return [];
        }
    }
}