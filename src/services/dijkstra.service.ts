import { ReturnPointModel } from '../models/ReturnPoint.model';
import { GeoJson, Geometry } from '../models/GeoJson.model';
import { AlgorithmPropertiesModel } from '../models/AlgorithmProperties.model';
import { MetricsService } from './metrics.service';
import { AlgorithmRepository } from '../repository/algorithm.repository';
import { DistanceFromStartDto } from '../models/DistanceFromStartDto';
import { PositionModelDto } from '../models/PositionModelDto';
import { ActivityTypeEnum } from '../enums/ActivityTypeEnum';
import { calculateZoneId, earthDistance, getClosestKey } from '../utils/utils.service';
import { DbEnum } from '../enums/DbEnum';
import { max, min, toNumber, uniqWith } from "lodash";
import { EntityTypeEnum } from '../enums/entityTypeEnum.enum';
const {performance} = require('perf_hooks');
export class DijkstraService {


    private distanceFromStart = new Map<any, DistanceFromStartDto>(); // Map of nodes with cost
    private nodeCountLength = 0;

    private endingNodes: any;
    private startingNodes: any;
    private previousNodes = new Map<any, any>(); //Map of previous optimal node visited, it's used at the end to retrive the path
    private previousTracks = new Map<any, any>(); //Map of previous optimal tracks visited, it's used at the end to retrive the path
    private visitedNodes = new Map<any, any>();; //Map of previous node visited;

    private arraySorted: any = []

    private zoneToBe: any;

    private elevationDelta: number = 200;
    private aStartLambda: number = 0.3;

    private isHike: any;
    private isAerialWay: any;
    private isPiste: any;

    private algorithmFinish: boolean = false;

    constructor(
        private algorithmRepository: AlgorithmRepository,
        private metricsService: MetricsService
    ) { }



    async dijkstra(start: PositionModelDto, end: PositionModelDto, options: any): Promise<any> {
        try {
            var container: any;
            var ovrallStart = performance.now();

            var totalFindStartEndZone = 0
            var totalAddStartEndZone = 0
            var totalGetClosestKey = 0;
            var totalSetVisitedZones = 0;
            var totalfindStartEndNodes = 0;
            var totalfindStartEndTrack = 0;
            var totalInitDistance = 0;
            var totalFindCurrentNode = 0;
            var totalFindNodeByZoneAndId = 0;
            var totalFindNeigbor = 0;
            var totalFindTracks = 0
            var totalMinTrack = 0
            var totalSetDistance = 0
            var totalLoadNewZone = 0;
            var totalFindRectangle = 0;

            this.isHike = options.mainActivity == ActivityTypeEnum.HIKE ? true : false;
            this.isAerialWay = (options.mainActivity == ActivityTypeEnum.AERIALWAY ? true : false);
            this.isPiste = options.mainActivity == ActivityTypeEnum.SKI ? true : false;

            //TODO TEMPORARY RESET, da togliere successivamente ai test
            this.algorithmRepository.resetData();
            this.resetVariables();


            // 1) FIND START END ZONE
            var p1 = performance.now();
            var startZoneId: PositionModelDto = calculateZoneId(start);
            var endZoneId: PositionModelDto = calculateZoneId(end);
            this.zoneToBe = this.findZoneRectangle(startZoneId, endZoneId)
            var p2 = performance.now();
            totalFindStartEndZone += p2 - p1
            
            // 2) LOAD DATA FROM START END ZONE
            var p1 = performance.now();

            if (this.isHike) {
                await this.addZoneToData(startZoneId);

                if (!startZoneId.equals(endZoneId)) {
                    await this.addZoneToData(endZoneId);
                }
            }

            var p2 = performance.now();
            totalAddStartEndZone += p2 - p1

            // 3) GET CLOSEST KEY
            var p1 = performance.now();
            var startingPoint: any = getClosestKey(start, this.algorithmRepository.findPointsByZone(startZoneId), DbEnum.Points);
            var endingPoint: any = getClosestKey(end, this.algorithmRepository.findPointsByZone(endZoneId), DbEnum.Points);
            var p2 = performance.now();
            totalGetClosestKey += p2 - p1

            //FIND THINGS

            var minElevation = min([startingPoint.e, endingPoint.e]);
            var maxElevation = max([startingPoint.e, endingPoint.e]);
            minElevation -= this.elevationDelta;
            maxElevation += this.elevationDelta;

            //4) ADD ZONE ALREADY VISITED
            var p1 = performance.now();
            var visitedZones: any = []
            visitedZones.push([startingPoint.x, startingPoint.y]);
            if (!startZoneId.equals(endZoneId)) {
                visitedZones.push([endingPoint.x, endingPoint.y]);
            }
            var p2 = performance.now();
            totalSetVisitedZones += p2 - p1

            // 5) FIND START END NODES
            var p1 = performance.now();
            this.startingNodes = this.findStartNodes(startingPoint, startZoneId);
            this.endingNodes = this.findEndNodes(endingPoint, endZoneId);
            var p2 = performance.now();
            totalfindStartEndNodes += p2 - p1

            // 6) FIND START END TRACK
            var p1 = performance.now();
            var startTracks = this.algorithmRepository.filterTracksByPoint(startingPoint, calculateZoneId(new PositionModelDto(startingPoint.c[1], startingPoint.c[0])));
            var endTracks = this.algorithmRepository.filterTracksByPoint(endingPoint, calculateZoneId(new PositionModelDto(endingPoint.c[1], endingPoint.c[0])));
            //Da togliere dopo implementazione punto A)
            startTracks = uniqWith(startTracks, (trackA: any, trackB: any) => trackA.i === trackB.i);
            endTracks = uniqWith(endTracks, (trackA: any, trackB: any) => trackA.i === trackB.i);
            var p2 = performance.now();
            totalfindStartEndTrack += p2 - p1

            // 7) INITIALIZE DISTANCEFROMSTART
            var p1 = performance.now();

            for (const node of this.startingNodes) {
                var distance = earthDistance(startingPoint.c, node.po.coordinates);
                var pendenza = ((node.po.elevation - startingPoint.e) / (distance * 1000)) * 100;
                var cost = await this.metricsService.getCost(startTracks[0], options, distance, pendenza);
                var distanceElement = new DistanceFromStartDto(node.i, cost, toNumber(node.y), toNumber(node.x));
                this.distanceFromStart.set(node.i, distanceElement);

                if (this.arraySorted.length > 0) {
                    this.arraySorted.splice(this.binarySearch(this.arraySorted, distanceElement, this.comp), 0, distanceElement)
                } else {
                    this.arraySorted.push(distanceElement)
                }
            }

            var p2 = performance.now();
            totalInitDistance += p2 - p1

            //CHECK PROHIBITIONS
            //TODO

            if (this.startingNodes.length == 0 || this.endingNodes.length == 0) {
                this.resetVariables();
                return null;
            }

            var nodeCount = 0

            while (nodeCount < this.nodeCountLength) {
                nodeCount += 1;
                // 8) FIND NODE WITH MINIMUM COST AND SET TO CURRENTNODE
                var p1 = performance.now();
                var distanceFromStartElement;

                while (this.visitedNodes.get(this.arraySorted[0].id) == 1) {
                    this.arraySorted.shift();
                }
                distanceFromStartElement = this.arraySorted[0];

                var p2 = performance.now();
                totalFindCurrentNode += p2 - p1

                if (distanceFromStartElement.cost == undefined || distanceFromStartElement == undefined) {
                    break;
                }

                //9) FIND NODE IN REPO
                var p1 = performance.now();
                var currentNode = this.algorithmRepository.findNodeById(distanceFromStartElement.id);
                var p2 = performance.now();
                totalFindNodeByZoneAndId += p2 - p1

                //SET NODE TO VISITED
                this.visitedNodes.set(currentNode.i, 1);

                var ptConnected = currentNode.n;

                //CHECK NEIGHBOR
                for (const neighborId of ptConnected) {
                    // 10) FIND NEIGHBOR
                    var p1 = performance.now()
                    var neighbor = this.algorithmRepository.findNodeById(neighborId);
                    var p2 = performance.now()
                    totalFindNeigbor += p2 - p1
                    if (neighbor) {

                        //CHECK TRACK INTEGRITY

                        // 11) FIND TRACKS THAT CONTAINS THE TWO NODES
                        var p1 = performance.now();
                        var trackList = this.findTracks(currentNode, neighbor);
                        var p2 = performance.now();
                        totalFindTracks += p2 - p1
                        var p1 = performance.now();
                        // 12) FIND THE MINIMUM TRACK COST
                        var trackWithMinimumCost: any = null;
                        var minimumCost: any = null;
                        for (const element of trackList) {
                            var cost = await this.metricsService.getCost(element, options, earthDistance(currentNode.po.coordinates, neighbor.po.coordinates), 0) // TODO, capire se gestire pendenza per la getCost
                            if (minimumCost == null || cost < minimumCost) {
                                minimumCost = cost;
                                trackWithMinimumCost = element;
                            }
                        }
                        var p2 = performance.now();
                        totalMinTrack += p2 - p1

                        var newCost = this.distanceFromStart.get(currentNode.i)?.cost + minimumCost;

                        var distanceFromStartNeighbor: DistanceFromStartDto | undefined = this.distanceFromStart.get(neighborId);

                        var dist = earthDistance(neighbor.po.coordinates, end);
                        newCost += (this.aStartLambda * dist);

                        if (options.mainActivity == "hike") {
                            //AGGIUNGE PESO SE SCENDO SOTTO L?ELEVAZIONE MINIMA O SOPRA A QUELLA MASSIMA 
                            if ((neighbor.po.elevation > maxElevation || neighbor.po.elevation < minElevation) && neighbor.po.elevation != -1) {
                                var elevationDist = earthDistance(currentNode.po.coordinates, neighbor.po.coordinates);
                                newCost += (this.elevationDelta * elevationDist);
                            }
                        }

                        // 13) SET DISTANCE
                        var p1 = performance.now();
                        if (!this.distanceFromStart.has(neighborId)) {
                            this.distanceFromStart.set(neighborId, new DistanceFromStartDto(undefined, undefined, undefined, undefined));
                        }
                        if (distanceFromStartNeighbor == undefined || (!!distanceFromStartNeighbor?.cost && (newCost < distanceFromStartNeighbor.cost))) {
                            var distanceElement = new DistanceFromStartDto(neighbor.i, newCost, toNumber(neighbor.y), toNumber(neighbor.x))
                            this.distanceFromStart.set(neighborId, distanceElement);
                            this.arraySorted.splice(this.binarySearch(this.arraySorted, distanceElement, this.comp), 0, distanceElement)
                            this.previousNodes.set(neighborId, currentNode);
                            this.previousTracks.set(neighborId, trackWithMinimumCost);
                        }
                        var p2 = performance.now();
                        totalSetDistance += p2 - p1;
                    } else {
                        // B) LOAD NEW ZONE
                        var p1 = performance.now();
                        var newZoneIds: any = [];
                        var connectedTracks: any = new Map(Object.entries(currentNode.t));
                        var trackIds = connectedTracks.get(neighborId.toString());
                        trackIds.forEach((trackId: any) => {
                            var track = this.algorithmRepository.findTrackById(trackId);
                            track.z.forEach((zoneId: any) => {
                                var notIncluded = !visitedZones.some((a: any) => zoneId.every((v: any, i: any) => v === a[i]));
                                if (notIncluded) {
                                    newZoneIds.push(zoneId);
                                    visitedZones.push(zoneId);
                                }
                            });
                        });
                        await newZoneIds.forEach(async (element: any) => {
                            await this.addZoneToData(new PositionModelDto(toNumber(element[1]), toNumber(element[0])))
                        });
                        this.visitedNodes.set(currentNode.i, 1);
                        var p2 = performance.now();
                        if (newZoneIds.length != 0) {
                            totalLoadNewZone += p2 - p1
                        }
                    }
                }


                for (const endingNode of this.endingNodes) {
                    if (endingNode.i == currentNode.i) {
                        console.log(`[1] totalFindStartEndZone took ${totalFindStartEndZone} milliseconds`)
                        console.log(`[2] totalAddStartEndZone took ${totalAddStartEndZone} milliseconds`)
                        console.log(`[3] totalGetClosestKey took ${totalGetClosestKey} milliseconds`)
                        console.log(`[4] totalSetVisitedZones took ${totalSetVisitedZones} milliseconds`)
                        console.log(`[5] totalfindStartEndNodes took ${totalfindStartEndNodes} milliseconds`)
                        console.log(`[6] totalfindStartEndTrack took ${totalfindStartEndTrack} milliseconds`)
                        console.log(`[7] totalInitDistance took ${totalInitDistance} milliseconds`)
                        console.log(`[8] totalFindCurrentNode took ${totalFindCurrentNode} milliseconds`)
                        console.log(`[9] totalFindNodeByZoneAndId took ${totalFindNodeByZoneAndId} milliseconds`)
                        console.log(`[9] totalFindNeigbor took ${totalFindNeigbor} milliseconds`)
                        console.log(`[11] totalFindTracks took ${totalFindTracks} milliseconds`)
                        console.log(`[12] totalMinTrack took ${totalMinTrack} milliseconds`)
                        console.log(`[13] totalSetDistance took ${totalSetDistance} milliseconds`)
                        console.log(`[B] totalLoadNewZone took ${totalLoadNewZone} milliseconds`)
                        this.algorithmFinish = true;
                    }
                }
                if (this.algorithmFinish) {
                    break;
                }
            }

            var nodePath = []
            var baseGeoJson = DijkstraService.baseLineStringGeoJson;
            var coordinates = [];
            var lastNode = currentNode;
            while (this.previousNodes.has(currentNode.i) && this.previousNodes.get(currentNode.i) != null) {
                nodePath.unshift(currentNode);
                var startNode = currentNode;
                var endNode = this.previousNodes.get(currentNode.i);
                var coord = this.calculateResultCoordinates(startNode, endNode);
                coordinates.push(...coord);
                currentNode = endNode;
            }

            var firstNode = currentNode;

            if (endTracks.length == 1) {
                //E' il caso in cui il punto finale si trova in mezzo ad una track, inserisco i punti mancanti;
                var coor = this.connectPointToResultCoordinates(endingPoint, lastNode, endTracks[0], "end");
                coordinates.unshift(...coor);
            }

            if (startTracks.length == 1) {
                //E' il caso in cui il punto finale si trova in mezzo ad una track, inserisco i punti mancanti;
                var coordi = this.connectPointToResultCoordinates(startingPoint, firstNode, startTracks[0], "start");
                coordinates.push(...coordi);
            }

            baseGeoJson.features[0].geometry.coordinates = coordinates;
            var ovrallEnd = performance.now();
            console.log(`[A] Calculating path took ${ovrallEnd - ovrallStart} milliseconds`)
            return baseGeoJson;
        } catch (error) {
            console.error("An error occurred in method dijkstra [AlgorithmService]: " + error);
        }
    }

    connectPointToResultCoordinates(point: any, node: any, track: any, type: string) {
        var pointInTrack = track.t;
        var coordinatesInTrack = track.c;
        var pointIndex = pointInTrack.indexOf(point.i);
        var nodeIndex = pointInTrack.indexOf(node.i)
        var res;
        if (nodeIndex != -1 && pointIndex != -1) {
            res = coordinatesInTrack.slice(pointIndex, nodeIndex + 1);
            if (type == "start") {
                if (pointIndex < nodeIndex) {
                    res = res.reverse();
                }
            } else {
                if (pointIndex > nodeIndex) {
                    res = res.reverse();
                }
            }

            return res;
        }
    }

    calculateResultCoordinates(startNode: any, endNode: any) {
        var track = this.previousTracks.get(startNode.i);
        var pointInTrack = track.t;
        var coordinatesInTrack = track.c;
        var startNodeIndex = pointInTrack.indexOf(startNode.i);
        var endNodeIndex = pointInTrack.indexOf(endNode.i)
        var res;

        if (startNodeIndex != -1 && endNodeIndex != -1) {
            if (startNodeIndex < endNodeIndex) {
                res = coordinatesInTrack.slice(startNodeIndex, endNodeIndex + 1);
            } else {
                res = coordinatesInTrack.slice(endNodeIndex, startNodeIndex + 1);
                res = res.reverse();
            }

            return res;
        }
    }

    findTracks(currentNode: any, neighbor: any) {
        //Find the neighbor with the minimum cost
        var tracksList = [];
        var connectedTracks: any = new Map(Object.entries(currentNode.t));
        var tracks = connectedTracks.get(neighbor.i.toString());


        if (tracks.length == 1) {
            //THERE IS ONLY ONE TRACK
            tracksList.push(this.algorithmRepository.findTrackById(tracks[0]));
        } else {
            //FIND TRACK WITH MINIMUM COST
            tracks.forEach(async (trackId: any) => {
                tracksList.push(this.algorithmRepository.findTrackById(trackId));
            });
        }

        return tracksList;
    }

    resetVariables() {
        this.algorithmRepository.resetData();
        this.startingNodes = []; // array with nearest nodes to startingPoint (max 2)
        this.endingNodes = []; // array with nearest nodes to endingPoint (max 2)
        this.previousNodes = new Map<any, any>(); //Map of previous optimal node visited, it's used at the end to retrive the path
        this.visitedNodes = new Map<any, any>();; //Map of previous node visited;
        this.distanceFromStart = new Map<any, any>(); // Map of nodes with cost
        this.previousTracks = new Map<any, any>(); // Map of tracks visited
        this.nodeCountLength = 0;
        this.arraySorted = []
        this.algorithmFinish = false
    }

    async addZoneToData(zoneId: PositionModelDto) {

        var isInZoneToBe = false;

        if (this.zoneToBe.length == 0) {
            isInZoneToBe = true;
        } else {
            for (const zone of this.zoneToBe) {
                if (zone.equals(zoneId)) {
                    isInZoneToBe = true;
                }
            }
        }

        if (isInZoneToBe) {
            console.log("LOADING [" + zoneId.lat + "," + zoneId.lng + "]")
            var nodeToLoad = await this.algorithmRepository.findAllByZoneId(EntityTypeEnum.Nodes, zoneId)
            var pointsToLoad = await this.algorithmRepository.findAllByZoneId(EntityTypeEnum.Points, zoneId)
            var trackToLoad = await this.algorithmRepository.findAllByZoneId(EntityTypeEnum.Tracks, zoneId)

            this.nodeCountLength += nodeToLoad.length;
            nodeToLoad.forEach((node: any) => {
                if (this.previousNodes.get(node.i) == undefined) {
                    this.previousNodes.set(node.i, null);
                }
                if (this.visitedNodes.get(node.i) != 1) {
                    this.visitedNodes.set(node.i, 0);
                }
            });
            await this.algorithmRepository.updateData({ zoneId: zoneId, list: nodeToLoad }, { zoneId: zoneId, list: pointsToLoad }, { zoneId: zoneId, list: trackToLoad }, null, null, null);
        }
    }

    findStartNodes(point: any, zoneId: PositionModelDto) {

        //TODO PSEUDOCODICE
        // SIA IN POINT CHE IN TRACK.T CI SARà LINFORMAZIONE SE IL PUNTO E' UN NODO O MENO...QUINDI:
        // IF POINT IS NODE (DIRECTLY) -> ADD TO STARTNODE, ELSE CHECK IN TRACK.T THE PREVIOUS AND NEXT NODE, STARTING FROM POINT INDEX IN TRACK.T
        // OPPURE                 //TODO Capire se fare direttamente una closestKey sui nodi (Attuale implementazione)
        var startNodes = []
        if (this.isPiste) {

        } else {
            var trackList = this.algorithmRepository.filterTracksByPoint(point, zoneId);
            if (trackList.length > 1) {
                //POINT E' UN NODO
                startNodes.push(this.algorithmRepository.findNodeById(point.i));
            } else {
                //POINT SI TROVA IN MEZZO A DEI NODI, PRENDO IL PRIMO E L'ULTIMO PUNTO DELLA TRACK
                var node = this.algorithmRepository.findNodeById(trackList[0].t[0])
                var node2 = this.algorithmRepository.findNodeById(trackList[0].t[trackList[0].t.length - 1])
                if (node != undefined) {
                    startNodes.push(node)
                }
                if (node2 != undefined) {
                    startNodes.push(node2);
                }
            }
        }

        return startNodes;


    }

    findEndNodes(point: any, zoneId: PositionModelDto) {

        //TODO PSEUDOCODICE
        // SIA IN POINT CHE IN TRACK.T CI SARà LINFORMAZIONE SE IL PUNTO E' UN NODO O MENO...QUINDI:
        // IF POINT IS NODE (DIRECTLY) -> ADD TO STARTNODE, ELSE CHECK IN TRACK.T THE PREVIOUS AND NEXT NODE, STARTING FROM POINT INDEX IN TRACK.T
        // OPPURE                 //TODO Capire se fare direttamente una closestKey sui nodi (Attuale implementazione)
        var endNodes = []
        if (this.isPiste) {

        } else {
            var trackList = this.algorithmRepository.filterTracksByPoint(point, zoneId);
            if (trackList.length > 1) {
                //POINT E' UN NODO
                endNodes.push(this.algorithmRepository.findNodeById(point.i));
            } else {
                //POINT SI TROVA IN MEZZO A DEI NODI, PRENDO IL PRIMO E L'ULTIMO PUNTO DELLA TRACK
                var node = this.algorithmRepository.findNodeById(trackList[0].t[0])
                var node2 = this.algorithmRepository.findNodeById(trackList[0].t[trackList[0].t.length - 1])
                if (node != undefined) {
                    endNodes.push(node)
                }
                if (node2 != undefined) {
                    endNodes.push(node2);
                }
            }
        }

        return endNodes;

    }

    findZoneRectangle(startZone: PositionModelDto, endZone: PositionModelDto) {

        var zoneToBe = []
        var minLat: any = min([startZone.lat, endZone.lat]);
        var maxLat: any = max([startZone.lat, endZone.lat]);

        var minLng: any = min([startZone.lng, endZone.lng]);
        var maxLng: any = max([startZone.lng, endZone.lng]);


        for (var a: any = minLat; a < maxLat + 0.025; a += 0.05) {
            for (var b: any = minLng; b < maxLng + 0.025; b += 0.05) {
                var stringA = a.toFixed(2);
                var stringB = b.toFixed(2);
                zoneToBe.push(new PositionModelDto(parseFloat(stringA), parseFloat(stringB)))
            }

        }
        return zoneToBe;

    }

    binarySearch(ar: any, el: any, compare_fn: any) {
        if (el.cost < ar[0].cost)
            return 0;
        if (el.cost > ar[ar.length - 1].cost)
            return ar.length;
        var m = 0;
        var n = ar.length - 1;
        while (m <= n) {
            var k = (n + m) >> 1;
            var cmp = compare_fn(el, ar[k]);
            if (cmp > 0) {
                m = k + 1;
            } else if (cmp < 0) {
                n = k - 1;
            } else {
                return k;
            }
        }
        return -m - 1;
    }

    comp(a: any, b: any) {
        return a['cost'] > b['cost']
    }

    public static baseLineStringGeoJson: any = {
        "type": "FeatureCollection",
        "features": [
          {
            "type": "Feature",
            "properties": {},
            "geometry": {
              "coordinates": [
                // [
                //   10.767515512250554,
                //   46.16120066367279
                // ],
                // [
                //   10.87166595930924,
                //   46.16103012461676
                // ]
              ],
              "type": "LineString"
            }
          }
        ]
      }
}

