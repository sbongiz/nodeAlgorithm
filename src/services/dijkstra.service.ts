import * as mapboxgl from 'mapbox-gl';
import { EntityTypeEnum } from '../enums/entityTypeEnum.enum';
import { calculateZoneId, colorByTrack, earthDistance, existProhibitions } from '../utils/utils.service';
import * as lodash from 'lodash';
import { of } from 'rxjs';
import { ReturnPointModel } from '../models/ReturnPoint.model';
import { GeoJson, Geometry } from '../models/GeoJson.model';
import { AlgorithmPropertiesModel } from '../models/AlgorithmProperties.model';
import { MetricsService } from './metrics.service';
import { AlgorithmRepository } from '../repository/algorithm.repository';

export class DijkstraService {

    constructor(
        private algorithmRepository: AlgorithmRepository,
        private metricsService: MetricsService
    ) { }

    private aStartLambda: number = 0.3;
    private elevationLambda: number = 0.3;
    private elevationDelta: number = 200;
    private options: any; //options to apply to the algorthm
    private startingNodes: any[] = []; // array with nearest nodes to startingPoint (max 2)
    private endingNodes: any[] = []; // array with nearest nodes to endingPoint (max 2)
    private startTrack: any; // track in which the starting point belong
    private endTrack: any; //track in which the ending point belong
    private previousNodes = new Map<any, any>(); //Map of previous optimal node visited, it's used at the end to retrive the path
    private visitedNodes = new Map<any, any>();; //Map of previous node visited;
    private distanceFromStart = new Map<any, any>(); // Map of nodes with cost
    private previousTracks = new Map<any, any>(); // Map of tracks visited
    private actualCost: any;
    private result: any[] = []; //result of pathfinding

    private algorithmHasFinished = false;
    //Response fields
    private overallAscent = 0;
    private overallDescent = 0;
    private time: any = [];

    private startingPoint: any;
    private endingPoint: any;
    private visitedZones: any[] = [];
    private startZoneId: any;
    private endZoneId: any;
    private maxElevation: any;
    private minElevation: any;

    private abortCalculating = false;

    //AIR
    private useAerialWayElements: any;
    private aNodes: any;
    private stations: any;
    private aerialway: any;

    //PISTE
    private usePiste: any;
    //NAVIGATION
    private nodeByZoneId: any;
    private tracksByZoneId: any;
    private pointsByZoneId: any;

    private usedStationStart: any[] = [];
    private usedStationEnd: any[] = [];
    private isRunning = false;
    private usePendenza = true;
    public setAbortCalculating(value: boolean) {
        this.abortCalculating = value;
    }

    public async dijkstra(start: any[], end: any[], options: { mainActivity: string; }) {
        console.time('algo')
        this.isRunning = true;

        this.abortCalculating = false;
        //var findStartEndStartTime = performance.now();
        this.options = options;
        //var overallStartTime = performance.now();

        this.useAerialWayElements = (options.mainActivity == 'aerialway' ? true : false) || (options.mainActivity == 'ski' ? true : false);
        this.usePiste = options.mainActivity == 'ski' ? true : false;


        this.startZoneId = calculateZoneId(new mapboxgl.LngLat(start[0], start[1]));
        console.log("Start ZONE: " + this.startZoneId);
        this.endZoneId = calculateZoneId(new mapboxgl.LngLat(end[0], end[1]));
        console.log("End ZONE: " + this.endZoneId);

        if (this.usePiste) {
            this.nodeByZoneId = await this.algorithmRepository.findAllNodesPiste();
            this.tracksByZoneId = await this.algorithmRepository.findAllTracksPiste();
            this.pointsByZoneId = await this.algorithmRepository.findAllPointsPiste();
        } else {
            this.nodeByZoneId = await this.algorithmRepository.findAllByZoneId(EntityTypeEnum.Nodes, this.startZoneId);
            this.tracksByZoneId = await this.algorithmRepository.findAllByZoneId(EntityTypeEnum.Tracks, this.startZoneId);
            this.pointsByZoneId = await this.algorithmRepository.findAllByZoneId(EntityTypeEnum.Points, this.startZoneId);
        }


        if (options.mainActivity == 'aerialway') {
            this.aNodes = await this.algorithmRepository.findAllANodes();
            this.stations = await this.algorithmRepository.findAllStations();
            this.aerialway = await this.algorithmRepository.findAllAerialway();
        }
        if (this.usePiste) {
            this.aNodes = await this.algorithmRepository.findAllANodesPiste();
            this.stations = await this.algorithmRepository.findAllStationsPiste();
            this.aerialway = await this.algorithmRepository.findAllAerialwayPiste();
        }


        if (this.endZoneId.some((v: any, i: string | number) => v !== this.startZoneId[i])) {
            var newNodes;
            var newPoints;
            var newTracks;
            if (!(options.mainActivity == 'ski')) {
                newNodes = await this.algorithmRepository.findAllByZoneId(EntityTypeEnum.Nodes, this.endZoneId);
                newPoints = await this.algorithmRepository.findAllByZoneId(EntityTypeEnum.Points, this.endZoneId);
                newTracks = await this.algorithmRepository.findAllByZoneId(EntityTypeEnum.Tracks, this.endZoneId);
                this.nodeByZoneId.push(...newNodes);
                this.pointsByZoneId.push(...newPoints);
                this.tracksByZoneId.push(...newTracks);
            }

        }


        this.nodeByZoneId = lodash.uniqWith(this.nodeByZoneId, (nodeA: any, nodeB: any) => nodeA.i === nodeB.i && nodeA.x === nodeB.x && nodeA.y == nodeB.y);
        this.tracksByZoneId = lodash.uniqWith(this.tracksByZoneId, (trackA: any, trackB: any) => trackA.i === trackB.i && trackA.x === trackB.x && trackA.y === trackB.y);

        this.algorithmRepository.setRepository(this.nodeByZoneId, this.tracksByZoneId, this.pointsByZoneId, this.stations, this.aNodes, this.aerialway);

        this.startingPoint = this.getClosestKey(start);
        this.endingPoint = this.getClosestKey(end);

        this.visitedZones.push([this.startingPoint.x, this.startingPoint.y]);
        this.visitedZones.push([this.endingPoint.x, this.endingPoint.y]);

        if (this.startingPoint.e < this.endingPoint.e) {
            this.minElevation = this.startingPoint.e - this.elevationDelta;
            this.maxElevation = this.endingPoint.e + this.elevationDelta;
        } else {
            this.minElevation = this.endingPoint.e - this.elevationDelta;
            this.maxElevation = this.startingPoint.e + this.elevationDelta;
        }

        //Check if starting and ending node have prohibitions for the activity
        var errorCode = this.checkProhibitionsAndReturnErrorCode(this.startingPoint, this.endingPoint);
        if (errorCode != null) {
            return errorCode;
        }


        this.findStartNodes(this.startingNodes, this.startingPoint, this.startTrack[0], this.distanceFromStart);
        this.findEndNodes(this.endingNodes, this.endingPoint, this.endTrack[0]);

        this.nodeByZoneId.forEach((node: { i: any; }) => {
            this.previousNodes.set(node.i, null);
            this.visitedNodes.set(node.i, 0);
        });

        if (this.useAerialWayElements) {
            this.aNodes.forEach((node: { i: any; }) => {
                this.previousNodes.set(node.i, null);
                this.visitedNodes.set(node.i, 0);
            });
        }

        var nodeCount = 0
        //var findStartEndEndTime = performance.now();
        //console.log(`[A] First part of dijkstra took ${findStartEndEndTime - findStartEndStartTime} milliseconds`)

        //var overallWhileStartTime = performance.now();
        var nodeCountLength = this.nodeByZoneId.length;
        if (this.useAerialWayElements) {
            nodeCountLength += this.aNodes.length
        }
        while (nodeCount < nodeCountLength) {
            nodeCount += 1;
            var isCurrentNodeANode = false;
            var currentNodeId: any;

            currentNodeId = this.findCurrentNodeId();


            //console.log("Current Node ID: " + currentNodeId + " Distance from start: " + this.distanceFromStart.get(currentNodeId));
            // If current_node's distance is INFINITY, the remaining unvisited
            // nodes are not connected to start_node, so we're done.
            if (this.distanceFromStart.get(currentNodeId) == undefined || currentNodeId == undefined) {
                break;
            }

            if (this.abortCalculating) {
                this.resetVariables();
                return null;
            }

            var currentNode = this.algorithmRepository.findNodeById(currentNodeId, (this.useAerialWayElements));
            var currentAnodeConnected = currentNode.a;
            if (this.useAerialWayElements && this.algorithmRepository.isCurrentNodeANode(currentNodeId)) {
                //console.log("ANode as currentNodeId: " + currentNodeId);
                isCurrentNodeANode = true;
                currentNode = this.algorithmRepository.findANodeFromId(currentNodeId);
            }

            //Aggiunge aNode connessi tra loro in salita non più di 10 metri
            if (currentAnodeConnected.length > currentNode.a.length) {
                currentAnodeConnected.forEach((aNodeId: any) => {
                    var aNode = this.algorithmRepository.findANodeFromId(aNodeId);
                    if (aNode != undefined) {
                        if (Math.abs(currentNode.po.elevation - aNode.po.elevation) < 10) {
                            if (!currentNode.a.includes(aNodeId)) {
                                currentNode.a.push(aNodeId);
                            }
                        }
                    }
                });
            }

            this.visitedNodes.set(currentNodeId, 1);


            // For each neighbor of current_node, check whether the total distance
            // to the neighbor via current_node is shorter than the distance we
            // currently have for that node. If it is, update the neighbor's values
            // for distance_from_start and previous_node.

            var ptConnected = currentNode.n;

            //Se arielway mergiare currentNode.n + currenNode.an (aerialway node)
            if (this.useAerialWayElements) {
                if (currentNode.a.length > 0) {
                    ptConnected.push(...currentNode.a);
                }
            }
            //var startPtConnected = performance.now();

            for (const neighborId of ptConnected) {
                var nextNode = this.algorithmRepository.findNodeById(neighborId, this.useAerialWayElements);


                if (nextNode) {

                    if (this.useAerialWayElements && currentNode.a.length > 0 && currentNode.a.includes(neighborId)) {
                        if (currentNode.d.get(neighborId.toString()) == undefined) {
                            currentNode.d.set(neighborId.toString(), nextNode.d.get(currentNode.i.toString()));
                        }
                        if (currentNode.t.get(neighborId.toString()) == undefined) {
                            currentNode.t.set(neighborId.toString(), nextNode.t.get(currentNode.i.toString()));
                        }
                    }

                    var trackId = this.findTrackWithMinimumCost(currentNode, nextNode.i);
                    //Trovato l'indice della track tra A e B pià corta, lo uso in connecterTracks per prendere la track effeettiva!)

                    // prendo la distanza 1, vado in connected tracks, prendo la prima e con i params ci calcolo il costo (gli id di connected_distance e connected_tracks combaciano), stessa cosa per quelle successive 
                    var track = this.algorithmRepository.findTrackById(trackId);

                    var shouldCalculate = track == undefined ? false : true;
                    if (this.usePiste) {
                        var indexCurrentOnTrack = track.t.indexOf(currentNodeId);
                        var indexNextNodeOnTrack = track.t.indexOf(nextNode.i);
                        var oneWayProp = track.p["oneway"];
                        var oneWay = false;
                        if (oneWayProp.length == 0 || oneWayProp.includes("yes")) {
                            oneWay = true
                        }

                        //TODO Capire se lasciare il check su elevazione, nel caso per arrivare a Pinzolo centro, l'ultimo tratto prima della seggiovia è in salita... quindi lui non lo prenderebbe senza check su elevation
                        if (indexCurrentOnTrack > indexNextNodeOnTrack && oneWay && (Math.abs(currentNode.po.elevation - nextNode.po.elevation) > 10)) {
                            //Vuol dire che la traccia che sto tendeno in cosiderazione è in salita (succede quando punto di partenza e arrivo è uguale sia per una traccia che per una aerialway [Vedi PATASCOSS])
                            shouldCalculate = false;
                        }
                    }

                    if (shouldCalculate) {
                        if (this.actualCost == undefined) {
                            //next
                        }

                        var newPath = this.distanceFromStart.get(currentNodeId) + this.actualCost;
                        var dist = earthDistance(nextNode.po.coordinates, end);
                        newPath += (this.aStartLambda * dist);

                        if (this.usePendenza) {
                            if ((nextNode.po.elevation > this.maxElevation || nextNode.po.elevation < this.minElevation) && nextNode.po.elevation != -1) {
                                var elevationDist = earthDistance(currentNode.po.coordinates, nextNode.po.coordinates);
                                newPath += (this.elevationDelta * elevationDist);
                            }
                        }

                        if (!this.distanceFromStart.has(neighborId)) {
                            this.distanceFromStart.set(neighborId, undefined);
                        }
                        if ((this.distanceFromStart.get(neighborId) == undefined) || (newPath < this.distanceFromStart.get(neighborId))) {
                            this.distanceFromStart.set(neighborId, newPath);
                            this.previousNodes.set(neighborId, currentNode);
                            this.previousTracks.set(neighborId, track);
                        }
                    }



                } else {
                    // Questo sarebbe il caso in cui devo caricare il nuovo TILE perchè sto arrivando verso il bordo
                    // calcolare zone da connectedTracks
                    var newZoneIdToLoad = this.getNewZoneIdToLoad(currentNode, neighborId);
                    for (const zoneId of newZoneIdToLoad) {
                        console.log("NEW ZONE LOADED: " + zoneId);
                        if (this.usePiste) {
                            // newNodes = await this.utilsService.getDataFromAssets(RepositoryEnum.PNodes, zoneId);
                            // newPoints = await this.utilsService.getDataFromAssets(RepositoryEnum.PPoints, zoneId);
                            // newTracks = await this.utilsService.getDataFromAssets(RepositoryEnum.PTracks, zoneId);
                        } else {
                            var newNodes: any = await this.algorithmRepository.findAllByZoneId(EntityTypeEnum.Nodes, zoneId);
                            var newPoints: any = await this.algorithmRepository.findAllByZoneId(EntityTypeEnum.Points, zoneId);
                            var newTracks: any = await this.algorithmRepository.findAllByZoneId(EntityTypeEnum.Tracks, zoneId);
                            this.nodeByZoneId.push(...newNodes);
                            this.pointsByZoneId.push(...newPoints);
                            this.tracksByZoneId.push(...newTracks);

                            nodeCountLength = this.nodeByZoneId.length;
                            newNodes.forEach((node: { i: any; }) => {
                                //Capire performance
                                if (this.previousNodes.get(node.i) == undefined) {
                                    this.previousNodes.set(node.i, null);
                                }
                                if (this.visitedNodes.get(node.i) != 1) {
                                    this.visitedNodes.set(node.i, 0);
                                }
                            });
                            this.algorithmRepository.setRepository(this.nodeByZoneId, this.tracksByZoneId, this.pointsByZoneId, this.stations, this.aNodes, this.aerialway);
                        }

                        //Capire se qui sopra si può sostituire direttamente non avendo in memoria tutti i dati (togliendo quelli appena utilizzati);
                        //Probabilmente mi servono ancora per il ciclo dopo, ma poi si potrebbero rimuovere
                        this.visitedNodes.set(currentNodeId, 0); //Questa riga è stata cambiata dall'estate! prima era al di guori del ciclo
                    }
                }
            }
            //var endPtConnected = performance.now();
            //console.log(`PtConnected took ${endPtConnected - startPtConnected} milliseconds with ` + ptConnected.length + "ptConnected")
            //Se c'è il filtro aerialway attivo TESTARE ANDALO CENTRO - CIMA PAGANELLA
            if (isCurrentNodeANode) { //air
                //OLD allora...current_node avrà una properetà in cui ci sarà l'id della stazione più vicina... (connectedStation)
                //OLD dal nodo stazione, avrò tutte le stazioni collegate (1 se normale, 2 se c'è la stazione intermedia),in questi node stazioni ci sarà una proprietà  che mi dice il connectedNode
                this.usePendenza = false;
                //Calcolo costo traccia air 
                var startStations = this.algorithmRepository.findStationsByANode(currentNode);

                for (const startStation of startStations) {
                    var aerialTracks = this.algorithmRepository.findAerialwayByStation(startStation);
                    var stationList = []
                    if (!this.usedStationStart.includes(startStation.i)) {
                        if (!startStation.n.includes(startStation.i)) {
                            this.usedStationStart.push(startStation.i);
                        }
                        if (!this.isStationClosed(startStation, true)) {
                            for (const aerialTrack of aerialTracks) {
                                stationList = this.algorithmRepository.findStationsByAerialway(aerialTrack, startStation.i);

                                if (!!currentNode && !!startStation && stationList.length > 0) {

                                    for (const endStation of stationList) {
                                        if (!this.usedStationEnd.includes(endStation.i)) {
                                            if (!endStation.n.includes(endStation.i)) {
                                                this.usedStationEnd.push(endStation.i)
                                            }
                                            if (!this.isStationClosed(endStation, false)) {
                                                var aerialNeighbors = this.algorithmRepository.findANodesByStation(endStation);
                                                for (const aerialNeighbor of aerialNeighbors) {
                                                    if (!!aerialNeighbor) {

                                                        var newZoneIds = [];
                                                        if (!this.visitedZones.some(a => [aerialTrack.x, aerialTrack.y].every((v, i) => v === a[i]))) {
                                                            //Aggiungo nel caso in cui non siano già state caricate, tutte le zone della aerialway, comrpesa se stessa (se parto da una stazione a monte, e a valle cambia zona, può essere che non abbia caricato).
                                                            newZoneIds.push([aerialTrack.x, aerialTrack.y]);
                                                        }
                                                        aerialTrack.z.forEach((zoneId: any[]) => {
                                                            var notIncluded = !this.visitedZones.some(a => zoneId.every((v: any, i: string | number) => v === a[i]));
                                                            if (notIncluded) {
                                                                newZoneIds.push(zoneId);
                                                                this.visitedZones.push(zoneId);
                                                            }
                                                        });

                                                        for (const zoneId of newZoneIds) {
                                                            console.log("NEW ZONE LOADED: " + zoneId);

                                                            if (this.usePiste) {
                                                                // newNodes = await this.utilsService.getDataFromAssets(RepositoryEnum.PNodes, zoneId);
                                                                // newPoints = await this.utilsService.getDataFromAssets(RepositoryEnum.PPoints, zoneId);
                                                                // newTracks = await this.utilsService.getDataFromAssets(RepositoryEnum.PTracks, zoneId);
                                                            } else {
                                                                var newNodes: any = await this.algorithmRepository.findAllByZoneId(EntityTypeEnum.Nodes, zoneId);
                                                                var newPoints: any = await this.algorithmRepository.findAllByZoneId(EntityTypeEnum.Points, zoneId);
                                                                var newTracks: any = await this.algorithmRepository.findAllByZoneId(EntityTypeEnum.Tracks, zoneId);

                                                                this.nodeByZoneId.push(...newNodes);
                                                                this.pointsByZoneId.push(...newPoints);
                                                                this.tracksByZoneId.push(...newTracks);

                                                                nodeCountLength = this.nodeByZoneId.length;

                                                                newNodes.forEach((node: { i: any; }) => {
                                                                    if (this.previousNodes.get(node.i) == undefined) {
                                                                        this.previousNodes.set(node.i, null);
                                                                        this.visitedNodes.set(node.i, 0);
                                                                    }
                                                                });
                                                                this.algorithmRepository.setRepository(this.nodeByZoneId, this.tracksByZoneId, this.pointsByZoneId, this.stations, this.aNodes, this.aerialway);
                                                            }

                                                        }

                                                        var additionalCost = 0;
                                                        if (this.usePiste) {
                                                            if (endStation.e < startStation.e) {
                                                                additionalCost = 999;
                                                            }
                                                        }

                                                        var pathAerial = this.distanceFromStart.get(currentNodeId) + additionalCost;
                                                        var dist = earthDistance(aerialNeighbor.po.coordinates, end);
                                                        pathAerial += (this.aStartLambda * dist);

                                                        if (!this.distanceFromStart.has(aerialNeighbor.i)) {
                                                            this.distanceFromStart.set(aerialNeighbor.i, undefined);
                                                        }


                                                        if ((this.distanceFromStart.get(aerialNeighbor.i) == undefined) || (pathAerial < this.distanceFromStart.get(aerialNeighbor.i))) {
                                                            this.distanceFromStart.set(aerialNeighbor.i, pathAerial);


                                                            var previousNode = this.previousNodes.get(endStation.i);
                                                            if (previousNode != undefined && previousNode != null) {
                                                                var previousNodeId = previousNode.i;
                                                                if ((aerialNeighbor.i != endStation.i) && (previousNodeId != aerialNeighbor.i)) {
                                                                    this.previousNodes.set(aerialNeighbor.i, endStation);
                                                                }
                                                            } else {
                                                                if (aerialNeighbor.i != endStation.i) {
                                                                    this.previousNodes.set(aerialNeighbor.i, endStation);

                                                                }
                                                            }

                                                            this.previousTracks.set(aerialNeighbor.i, aerialTrack);


                                                            var previousNode = this.previousNodes.get(startStation.i);
                                                            if (previousNode != undefined && previousNode != null) {
                                                                var previousNodeId = previousNode.i;
                                                                if ((endStation.i != startStation.i) && (previousNodeId != endStation.i)) {
                                                                    this.previousNodes.set(endStation.i, startStation);
                                                                }
                                                            } else {
                                                                if (endStation.i != startStation.i) {
                                                                    this.previousNodes.set(endStation.i, startStation);
                                                                }
                                                            }

                                                            this.previousTracks.set(endStation.i, aerialTrack);

                                                            var previousNode = this.previousNodes.get(currentNodeId);
                                                            if (previousNode != undefined && previousNode != null) {
                                                                var previousNodeId = previousNode.i;
                                                                if ((startStation.i != currentNode.i) && (previousNodeId != startStation.i)) {
                                                                    this.previousNodes.set(startStation.i, currentNode)
                                                                }
                                                            } else {
                                                                if (startStation.i != currentNode.i) {
                                                                    this.previousNodes.set(startStation.i, currentNode)
                                                                }
                                                            }
                                                            if (!this.previousTracks.has(startStation.i)) { //FIX su nodo di partenza funivia che prende traccia sbagliata e disegna una retta con il nodo precedente!
                                                                this.previousTracks.set(startStation.i, aerialTrack);
                                                            }
                                                        }
                                                    }
                                                };
                                            }
                                        }

                                    }

                                } else {
                                    console.log("ANode not found for station: " + stationList[0].i);
                                }
                            }
                        }
                    }
                }
            }



            //controllo se in endingNodes c'è il nodo finale, in quel caso esco
            this.endingNodes.forEach(endingNode => {
                if (endingNode.i == currentNodeId) {
                    this.algorithmHasFinished = true;
                }
            });
            if (this.algorithmHasFinished) {
                break;
            }
        }
        //var overallWhileEndTime = performance.now();
        //console.log(`[A] While took ${overallWhileEndTime - overallWhileStartTime} milliseconds`)


        //var responseStartTime = performance.now();
        var nodePath = [];

        if (!this.algorithmHasFinished) {
            this.resetVariables();
            return of(null);
        }

        //in previusnode non ho già i nodi ordinatii?
        while (this.previousNodes.has(currentNodeId) && this.previousNodes.get(currentNodeId) != null) {
            nodePath.unshift(currentNode);
            var startNode = currentNode;
            var endNode = this.previousNodes.get(currentNodeId);
            var track = this.previousTracks.get(currentNodeId);
            this.calculateResultPoints(startNode, endNode, track, this.pointsByZoneId, this.stations);
            currentNode = endNode;
            currentNodeId = currentNode.i;
        }
        nodePath.unshift(currentNode);


        this.calculateStartEndPoints(this.startTrack[0], nodePath, this.startingPoint, "start");
        this.calculateStartEndPoints(this.endTrack[0], nodePath, this.endingPoint, "end");

        var resultPointList: any = this.result.reverse();
        //remove double point
        resultPointList = resultPointList.filter((item: any, index: any) => resultPointList.indexOf(item) === index);
        // var responseEndTime = performance.now();
        // console.log(`[A] Calculating response took ${responseEndTime - responseStartTime} milliseconds`)
        // var overallEndTime = performance.now();
        // console.log(`[A] Calculating path took ${overallEndTime - overallStartTime} milliseconds`)
        return this.createResponse(resultPointList);
    }

    private isStationClosed(station: { p: { [x: string]: string; }; }, isStartStation: boolean) {

        if (this.usePiste) {
            return false
        }

        if (!!station.p && !!station.p["aerialway:summer:access"] && station.p["aerialway:summer:access"] != "no") {
            if (isStartStation && station.p["aerialway:summer:access"] == "exit") {
                return true
            }
            return false;
        }
        return true;
    }

    private getNewZoneIdToLoad(currentNode: { t: any; }, neighborId: { toString: () => any; }) {

        var newZoneIds: any[] = [];
        var connectedTracks = currentNode.t;
        var trackIds = connectedTracks.get(neighborId.toString());
        trackIds.forEach((trackId: any) => {
            var track = this.algorithmRepository.findTrackById(trackId);
            track.z.forEach((zoneId: any[]) => {
                var notIncluded = !this.visitedZones.some(a => zoneId.every((v: any, i: string | number) => v === a[i]));
                if (notIncluded) {
                    newZoneIds.push(zoneId);
                    this.visitedZones.push(zoneId);
                }
            });
        });

        return newZoneIds;
    }

    private resetVariables() {
        this.algorithmRepository.resetRepository();
        this.algorithmHasFinished = false;
        this.startingNodes = []; // array with nearest nodes to startingPoint (max 2)
        this.endingNodes = []; // array with nearest nodes to endingPoint (max 2)
        this.previousNodes = new Map<any, any>(); //Map of previous optimal node visited, it's used at the end to retrive the path
        this.visitedNodes = new Map<any, any>();; //Map of previous node visited;
        this.distanceFromStart = new Map<any, any>(); // Map of nodes with cost
        this.previousTracks = new Map<any, any>(); // Map of tracks visited
        this.result = []; //result of pathfinding
        this.overallAscent = 0;
        this.overallDescent = 0;
        this.time = [];
        this.endingPoint = null;
        this.startingPoint = null;
        this.endTrack = null;
        this.visitedZones = [];
        this.usedStationStart = [];
        this.usedStationEnd = [];
        this.isRunning = false;
        this.usePendenza = true;
    }
    private calculateStartEndPoints(track: { t: string | any[]; }, nodePath: string | any[], point: { i: any; }, type: string) {

        var nodePathIndex;
        if (type == "start") {
            nodePathIndex = 0;
        } else {
            nodePathIndex = nodePath.length - 1;
        }

        var index = track.t.indexOf(point.i);
        var nodeIndex = track.t.indexOf(nodePath[nodePathIndex].i);

        var res: any;
        if (index < nodeIndex) {
            res = track.t.slice(index, nodeIndex + 1);
        } else {
            res = track.t.slice(nodeIndex, index + 1);
        }


        if (res[0] != nodePath[nodePathIndex].i) {
            res = res.reverse();
        }
        res.forEach((coord: any) => {
            if (type == "start") {
                this.result.push(this.algorithmRepository.findPointById(coord, this.useAerialWayElements));
            } else {
                this.result.unshift(this.algorithmRepository.findPointById(coord, this.useAerialWayElements));
            }

        });
    }

    private calculateResultPoints(startNode: { po: undefined; i: any; isAerialway: boolean; }, endNode: { po: undefined; i: any; isAerialway: boolean; }, track: { t: any; p: any; }, pointList: any, stationList: any) {

        var points = track.t;
        if (this.useAerialWayElements && points == undefined) {
            //Caso di unire nodo-stazione | stazione- stazione | stazione-nodo
            points = track.p;
            var startNodeIndex = startNode.po == undefined ? points.indexOf(startNode.i) : points.indexOf(startNode.i)
            var endNodeIndex = endNode.po == undefined ? points.indexOf(endNode.i) : points.indexOf(endNode.i)

            if (startNodeIndex == -1 && endNodeIndex != -1) {
                var resultPoint = this.algorithmRepository.findPointById(startNode.i, this.useAerialWayElements);
                this.result.push(resultPoint);
                this.result.push(endNode);
            } else if (startNodeIndex != -1 && endNodeIndex == -1) {
                // if (endNode.po == undefined) {
                //     debugger;
                // }
                this.result.push(startNode);
                var resultPoint = this.algorithmRepository.findPointById(endNode.i, this.useAerialWayElements);
                this.result.push(resultPoint);
            } else {
                startNode.isAerialway = true;
                endNode.isAerialway = true;
                this.result.push(startNode);
                this.result.push(endNode);
            }

        } else {
            //Caso normale nodo-nodo
            var startNodeIndex = points.indexOf(startNode.i);
            var endNodeIndex = points.indexOf(endNode.i);
            if (startNodeIndex != -1 && endNodeIndex != -1) {

                var res;
                if (startNodeIndex < endNodeIndex) {
                    res = points.slice(startNodeIndex, endNodeIndex + 1);
                } else {
                    res = points.slice(endNodeIndex, startNodeIndex + 1);
                }

                if (res[0] != startNode.i) {
                    res = res.reverse();
                }
                res.forEach((coord: any) => {
                    this.result.push(this.algorithmRepository.findPointById(coord, this.useAerialWayElements));
                });
            }
        }


    }

    private getClosestKey(coordinates: any[]) {
        //TODO: migliorare con logica a zone
        var mindist: number | undefined = undefined;
        var closestNode = undefined;

        //TODO prendere points dal DB 

        this.pointsByZoneId.forEach((point: { c: any[]; }) => {
            var distance = earthDistance(point.c, coordinates);
            if (mindist == undefined || distance < mindist) {
                closestNode = point;
                mindist = distance;
            }
        });
        return closestNode;
    }

    private checkProhibitionsAndReturnErrorCode(startPoint: any, endPoint: any) {

        //Gestire più tracce
        //Capire come discriminare quale delle due tracce usare se ce ne sono multiple
        this.startTrack = this.algorithmRepository.filterTracksByPoint(startPoint);
        //if (!!endPoint) {
        this.endTrack = this.algorithmRepository.filterTracksByPoint(endPoint);
        //}


        //fare ciclo per più tracce
        // Se tutte le tracce hanno foot no errore!

        var prohibitionsArray = [];

        for (const track of this.startTrack) {
            prohibitionsArray.push(existProhibitions(this.options, track));
        }

        if (prohibitionsArray.every(Boolean)) {
            //PROIBITHIONS ERROR
        }

        var prohibitionsArray = [];

        for (const track of this.endTrack) {
            prohibitionsArray.push(existProhibitions(this.options, track));
        }

        if (prohibitionsArray.every(Boolean)) {
            //PROIBITHIONS ERROR
        }


        return null;
    }

    private findStartNodes(array: any[], point: { i: any; e: number; c: any[]; }, track: { t: string | any[]; i: any; }, distanceFromStart: Map<any, any>) {
        // finding starting and ending nodes
        if (this.algorithmRepository.isNodeFromPoint(point)) {
            var node = this.algorithmRepository.findNodeById(point.i, this.useAerialWayElements);
            array.push(node);
            distanceFromStart.set(point.i, 0); //set the cost to 0 if the point is a node
        } else {
            var indiceStarting = track.t.indexOf(point.i);

            var i = indiceStarting + 1;
            while (!this.algorithmRepository.isNodeFromPointId(track.t[i], this.usePiste) && i < track.t.length - 1) {
                //cumulare distanza da passare a getCost
                i += 1;
            }
            if (i <= track.t.length - 1) {
                var nextNodeId = track.t[i];
                var nextNode = this.algorithmRepository.findNodeById(nextNodeId, this.useAerialWayElements);

                if (!!nextNode) {
                    if (this.usePiste) {
                        if (nextNode.po.elevation <= point.e || Math.abs(nextNode.po.elevation - point.e) < 5) {
                            array.push(nextNode);
                            //TODO subottima, meglio fare sum di distanze da punto a punto
                            //Il calcolo della distancza fino al nodo va fatto solamente in questa funzione, per gli altri costi si fa riferimento a node.connected_distance[nextNodeId]
                            //Calcaolare la perndenza da point a NextNode e passsarla alla getCost
                            var distance = earthDistance(point.c, nextNode.po.coordinates);
                            var pendenza = Math.abs(point.e - nextNode.po.elevation) / (distance * 1000);
                            distanceFromStart.set(nextNodeId, this.metricsService.getCost(track, this.options, distance, pendenza));
                        }
                    } else {
                        array.push(nextNode);
                        //TODO subottima, meglio fare sum di distanze da punto a punto
                        //Il calcolo della distancza fino al nodo va fatto solamente in questa funzione, per gli altri costi si fa riferimento a node.connected_distance[nextNodeId]
                        //Calcaolare la perndenza da point a NextNode e passsarla alla getCost
                        var distance = earthDistance(point.c, nextNode.po.coordinates);
                        var pendenza = Math.abs(point.e - nextNode.po.elevation) / (distance * 1000);
                        distanceFromStart.set(nextNodeId, this.metricsService.getCost(track, this.options, distance, pendenza));
                    }
                }
            }

            var j = indiceStarting - 1;
            while (!this.algorithmRepository.isNodeFromPointId(track.t[j], this.usePiste) && j >= 0) {
                j -= 1;
            }
            if (j >= 0) {
                var previousNodeId = track.t[j];
                var previousNode = this.algorithmRepository.findNodeById(previousNodeId, this.useAerialWayElements);
                if (!!previousNode) {
                    if (this.usePiste) {
                        if (previousNode.po.elevation <= point.e || Math.abs(previousNode.po.elevation - point.e) < 5) {
                            array.push(previousNode);
                            var distance = earthDistance(point.c, previousNode.po.coordinates)
                            var pendenza = Math.abs(point.e - previousNode.po.elevation) / (distance * 1000);
                            distanceFromStart.set(previousNodeId, this.metricsService.getCost(track, this.options, distance, pendenza));

                        }
                    } else {
                        array.push(previousNode);
                        var distance = earthDistance(point.c, previousNode.po.coordinates)
                        var pendenza = Math.abs(point.e - previousNode.po.elevation) / (distance * 1000);
                        distanceFromStart.set(previousNodeId, this.metricsService.getCost(track, this.options, distance, pendenza));
                    }
                }
            }
        }


        if (this.usePiste) {
            if (this.startingNodes.length == 0) {
                var aNodes = this.algorithmRepository.findANodeFromTrack(track.i);
                //var stations = this.algorithmRepository.findStationsByANode(aNode);
                var aNodesSoreted = aNodes.sort((a: { po: { elevation: number; }; }, b: { po: { elevation: number; }; }) => a.po.elevation - b.po.elevation);
                var aNode = aNodesSoreted[0];
                array.push(aNode);
                if (!!distanceFromStart) {
                    var distance = earthDistance(point.c, aNode.po.coordinates);
                    var pendenza = Math.abs(point.e - aNode.po.elevation) / (distance * 1000);
                    distanceFromStart.set(aNode.i, distance)
                }
            }
        }

    }

    private findEndNodes(array: any[], point: { i: any; e: number; c: any[]; }, track: { t: string | any[]; i: any; }) {
        if (this.algorithmRepository.isNodeFromPoint(point)) {
            var node = this.algorithmRepository.findNodeById(point.i, this.useAerialWayElements);
            array.push(node);
        } else {
            var indiceStarting = track.t.indexOf(point.i);

            var i = indiceStarting + 1;
            while (!this.algorithmRepository.isNodeFromPointId(track.t[i], this.usePiste) && i < track.t.length - 1) {
                //cumulare distanza da passare a getCost
                i += 1;
            }
            if (i <= track.t.length - 1) {
                var nextNodeId = track.t[i];
                var nextNode = this.algorithmRepository.findNodeById(nextNodeId, this.useAerialWayElements);

                if (!!nextNode) {
                    if (this.usePiste) {
                        if (nextNode.po.elevation >= point.e || Math.abs(nextNode.po.elevation - point.e) < 5) {
                            array.push(nextNode);
                        }
                    } else {
                        array.push(nextNode);
                    }
                }
            }

            var j = indiceStarting - 1;
            while (!this.algorithmRepository.isNodeFromPointId(track.t[j], this.usePiste) && j >= 0) {
                j -= 1;
            }
            if (j >= 0) {
                var previousNodeId = track.t[j];
                var previousNode = this.algorithmRepository.findNodeById(previousNodeId, this.useAerialWayElements);
                if (!!previousNode) {
                    if (this.usePiste) {
                        if (previousNode.po.elevation >= point.e || Math.abs(previousNode.po.elevation - point.e) < 5) {
                            array.push(previousNode);
                        }
                    } else {
                        array.push(previousNode);
                    }
                }
            }
        }

        if (this.usePiste) {
            if (this.endingNodes.length == 0) {
                var aNodes = this.algorithmRepository.findANodeFromTrack(track.i);
                var aNodesSoreted = aNodes.sort((a: { po: { elevation: number; }; }, b: { po: { elevation: number; }; }) => a.po.elevation - b.po.elevation);
                var aNode = aNodesSoreted[aNodesSoreted.length - 1];
                //var stations = this.algorithmRepository.findStationsByANode(aNode);
                //Predere l'anode più vicino al punto di arrivo con elevazione non superiore a 10

                var minIdx = 0;
                aNodes.forEach((aNode: { po: { coordinates: any[]; elevation: number; }; }, i: number) => {
                    if ((earthDistance(aNode.po.coordinates, point.c) < earthDistance(aNodes[minIdx].po.coordinates, point.c)) && (Math.abs(aNode.po.elevation - point.e) < 10)) {
                        minIdx = i;
                    }
                })

                array.push(aNodes[minIdx]);
            } else {
                //Controllo se ci sono degli Anode più vicini all'arrivo, se esistono li aggiungo come punto di arrivo
                var aNodes = this.algorithmRepository.findANodeFromTrack(track.i);
                var distanceArray: number[] = [];
                aNodes.forEach((aNode: { po: { coordinates: any[]; }; }) => {
                    distanceArray.push(earthDistance(aNode.po.coordinates, point.c));
                });
                var minIdx = Math.min(...distanceArray);
                var aNode = aNodes[distanceArray.indexOf(minIdx)];
                var resultArray: any[] = [];
                array.forEach((endingNode: { po: { coordinates: any[]; }; }, i: number) => {
                    if (earthDistance(endingNode.po.coordinates, point.c) > distanceArray[distanceArray.indexOf(minIdx)] && (Math.abs(aNode.po.elevation - point.e) < 10)) {
                        resultArray[i] = true;
                    } else {
                        resultArray[i] = false;
                    }
                });

                if (resultArray.every(element => element === true)) {
                    this.endingNodes = [];
                    this.endingNodes.push(aNode)
                }
            }
        }
    }

    private findCurrentNodeId() {

        // Set current_node to the unvisited node with shortest distance
        // calculated so far.
        var candidates = [];

        //TODO Dividere in due liste distanceFromStart quelli già con costo e in un altra lista quelli non visitati?
        for (let key of this.distanceFromStart.keys()) {
            if (this.visitedNodes.has(key)) {
                if (this.visitedNodes.get(key) == 0) {
                    candidates.push(key);
                }
            } else {
                console.log("Key not found in visitedNode");
                this.visitedNodes.set(key, 1);
                this.distanceFromStart.set(key, undefined); // set the cost to infinity
            }
        }

        var currentNodeId = null;
        var minCost: number | null = null;
        candidates.forEach(candidateId => {
            if (minCost == null) {
                minCost = this.distanceFromStart.get(candidateId);
                currentNodeId = candidateId;
            } else if (this.distanceFromStart.get(candidateId) < minCost) {
                minCost = this.distanceFromStart.get(candidateId);
                currentNodeId = candidateId;
            }
        });

        if (currentNodeId == null) {
            console.log("No candidates for chosen path!");
            return [];
        } else {
            return currentNodeId;
        }
    }

    private findTrackWithMinimumCost(currentNode: { d: any; t: any; po: { coordinates: any[]; elevation: number; }; }, nextNodeId: { toString: () => any; }) {
        //Find the neighbor with the minimum cost
        var nextNode = this.algorithmRepository.findNodeById(nextNodeId, this.useAerialWayElements);
        var idxShorter = 0;
        var tmpMinCost: number | null = null;

        var connectedDistance = currentNode.d;
        var connectedTracks = currentNode.t;
        var arrayDistance = connectedDistance.get(nextNodeId.toString());
        arrayDistance.forEach((element: string, i: number) => {
            var trackId = connectedTracks.get(nextNodeId.toString())[i];
            var track = this.algorithmRepository.findTrackById(trackId);

            if (track != undefined) { // IF aggiunto su SERVER ONLINE nel caso in cui non abbia i dati su DB
                var distance = earthDistance(currentNode.po.coordinates, nextNode.po.coordinates);
                var pendenza = Math.abs(currentNode.po.elevation - nextNode.po.elevation) / (parseInt(element) * 1000);
                var cost = this.metricsService.getCost(track, this.options, distance, pendenza);
                if (tmpMinCost == null) {
                    idxShorter = i;
                    this.actualCost = cost;
                }
                else if (cost < tmpMinCost) {
                    idxShorter = i;
                    this.actualCost = cost;
                }
            } else {
                this.actualCost = 9999999999999999999;
            }

        });

        return connectedTracks.get(nextNodeId.toString())[idxShorter];
    }

    //CREATE RESPONSE METHODS 
    private createReturnPoint(point: { po: { coordinates: any; tracks: any[]; elevation: any; }; c: any; t: any[]; a: string | any[]; i: any; e: any; }) {
        //fare merge di tutte le proprietà delle track
        var retPoint = new ReturnPointModel();
        retPoint.coordinates = point.po != undefined ? point.po.coordinates : point.c;
        var track = this.algorithmRepository.findTrackById(point.po != undefined ? point.po.tracks[0] : point.t[0]);
        if (track == undefined) {
            //Airial case

            if (point.a.length == 0) {
                //Caso in cui l'id della staazione combacia con l'id dell'ultimo nodo del path.
                point = this.algorithmRepository.findStationsById(point.i);
            }

            if (point == undefined) {
                debugger;
            }
            track = this.algorithmRepository.findAerialwayByStation(point);

            //Se ci sono due track capire come unire i params
            track = track[0];

            retPoint.params = track.pr;
            retPoint.elevation = point.e;
            retPoint.isNode = true
            retPoint.isAnode = false;
            retPoint.isAerialway = true;
            retPoint.id = point.i;
            return retPoint;
        }

        retPoint.params = track.p;
        retPoint.elevation = point.po == undefined ? point.e : point.po.elevation;
        retPoint.isAerialway = false;
        retPoint.id = point.i;
        retPoint.isNode = this.algorithmRepository.isNodeFromPoint(point);
        if (this.useAerialWayElements) {
            retPoint.isAnode = this.algorithmRepository.isAnodeFromId(point.i);;
        } else {
            retPoint.isAnode = false;
        }
        return retPoint;
    }


    private createResponse(resultPointList: never[]) {

        var featuresArray = this.createFeatures(resultPointList);
        featuresArray.push({ type: "Feature", geometry: null, properties: this.createProperties(resultPointList) });
        var resultObject = new GeoJson(featuresArray, "FeatureCollection");
        this.resetVariables();
        console.timeEnd('algo')
        return resultObject;
    }

    private createFeatures(coordinateList: { isAerialway: any; }[]) {

        var featuresArray: { type: string; geometry: any; properties: { color: any; } | { color: any; }; }[] = [];
        var beforeIsAerialway = coordinateList[0].isAerialway ? true : false;
        var pointList = [];
        for (const point of coordinateList) {
            if (point.isAerialway == undefined) {
                point.isAerialway = false;
            }
            if (point.isAerialway == beforeIsAerialway) {
                pointList.push(point);
            } else {
                beforeIsAerialway = point.isAerialway;
                pointList.push(point);
                var tracksToShow = this.generateTracksToShow(pointList);
                tracksToShow.forEach(track => {
                    featuresArray.push({ type: "Feature", geometry: this.createLineString(track.points), properties: { color: track.color } })

                });
                pointList = [];
                pointList.push(point);
            }
        }
        //Aggiungo prima feature

        var tracksToShow = this.generateTracksToShow(pointList);
        tracksToShow.forEach(track => {
            featuresArray.push({ type: "Feature", geometry: this.createLineString(track.points), properties: { color: track.color } })

        });
        return featuresArray;
    }

    generateTracksToShow(pointList: any[]): any[] {
        var result: any[] = [];

        pointList.forEach((point, i) => {
            var nextPoint = null;
            if (i < pointList.length) {
                nextPoint = pointList[i + 1]
            }
            var track = this.getTrackByPoints(point, nextPoint);
            var color;
            if (track == undefined) {
                // Caso in cui devo collegare PNode ad una stazione staccata dalla pista.
                color = "#5473E8"
            } else {
                color = colorByTrack(track, point.isAerialway);
            }

            if (result.length == 0) {
                result.push({
                    points: [point],
                    color: color
                })
            } else if (result[result.length - 1].color != color) {
                result[result.length - 1].points.push(point);
                result.push({
                    points: [point],
                    color: color
                })
            } else {
                result[result.length - 1].points.push(point);
            }
        });
        return result;
    }

    private getTrackByPoint(point: any) {
        return this.algorithmRepository.findTrackById(point.po != undefined ? point.po.tracks[0] : point.t[0]);
    }

    private getTrackByPoints(point: any, nextPoint: any) {
        var tracks;
        if (point.isAerialway) {
            if (point.a.length == 0) {
                point = this.algorithmRepository.findStationsById(point.i);
            }
            tracks = this.algorithmRepository.findAerialwayByStation(point)
        } else {
            tracks = this.algorithmRepository.findTracksByIds(point.t);
        }

        if (!!tracks && !!nextPoint && !!nextPoint.i && (point.isAerialway == nextPoint.isAerialway))
            if (point.isAerialway) {
                return tracks.find((x: { p: string | any[]; }) => x.p.includes(nextPoint.i));
            } else {
                return tracks.find((x: { t: string | any[]; }) => x.t.includes(nextPoint.i))
            }
        else
            return tracks[0];
    }

    private createLineString(resultPointList: any[]) {
        var coordinates: any[] = [];

        resultPointList.forEach((point: { po: { coordinates: any; } | undefined; c: any; }) => {
            coordinates.push(point.po == undefined ? point.c : point.po.coordinates);
        });
        return new Geometry("LineString", coordinates);
    }


    private createProperties(resultPointList: any[]): any {
        var properties = new AlgorithmPropertiesModel();

        var distance: number[] = [];
        var elevation: any[] = [];
        var points: any[] = [];

        resultPointList.forEach((point: any, i: number) => {

            points.push(this.createReturnPoint(point));
            //Distance Array
            if (i > 0) {
                var prevPoint = resultPointList[i - 1];
                var prevCoord = prevPoint.po == undefined ? prevPoint.c : prevPoint.po.coordinates;
                var pointCoord = point.po == undefined ? point.c : point.po.coordinates;
                var eDistance = earthDistance(prevCoord, pointCoord);
                distance.push(distance[distance.length - 1] + eDistance);

                //time bike - hike - aerialway
                var retPoint = points.find(x => x.id == point.i);
                var prevElev = prevPoint.po == undefined ? prevPoint.e : prevPoint.po.elevation;
                var pointElev = point.po == undefined ? point.e : point.po.elevation;
                this.calculateTimes(eDistance, prevElev, pointElev, retPoint, this.usePiste);

            } else {
                distance.push(0);
                this.time.push(0);
            }

            //elevation
            if ((point.po == undefined ? point.e : point.po.elevation) == -1) {
                if (i != 0) {
                    var elem = resultPointList[i - 1];
                    var elev = elem.po == undefined ? elem.e : elem.po.elevation;
                    elevation.push(elev);
                } else {
                    var elem = resultPointList[i + 1];
                    var elev = elem.po == undefined ? elem.e : elem.po.elevation;
                    elevation.push(elev);
                }
            } else {
                elevation.push(point.po == undefined ? point.e : point.po.elevation);
            }


        });

        properties.distance = distance;
        properties.elevation = elevation;
        //overallAscent - overallDescent
        this.gain(elevation);
        properties.overallAscent = this.overallAscent;
        properties.overallDescent = this.overallDescent;
        properties.time = this.time;
        properties.points = points;
        return properties;
    }

    private gain(elevationList: any) {
        //pesare di centrare la media sul punto, quindi 5 in avanti e 5 indietro. 
        this.overallAscent = 0;
        this.overallDescent = 0;

        var newElev = [elevationList[0]];
        var tmpElev: any[] = [];
        elevationList.forEach((element: any, i: number) => {
            tmpElev.push(element);
            if (i % 10 == 0 && i != 0) {
                var mean = this.calculateEffectiveGain(newElev, tmpElev);
                newElev.push(mean);
                tmpElev = [];
            }
        });

        if (tmpElev.length > 0) {
            this.calculateEffectiveGain(newElev, tmpElev);

        }
    }

    private calculateEffectiveGain(newElev: string | any[], tmpElev: any[]) {
        var elevationValues = 0;
        tmpElev.forEach((tmpElem: number) => {
            elevationValues += tmpElem;
        });
        var mean = elevationValues / tmpElev.length;
        var segment = mean - newElev[newElev.length - 1];
        if (segment > 0) {
            this.overallAscent += segment;
        } else {
            this.overallDescent += -segment;
        }
        return mean;
    }

    private calculateTimes(eDistance: number, prevElev: number, currentElev: number, retPoint: { isAerialway: any; params: { [x: string]: any; }; }, usePiste: any) {
        var isAerialway = retPoint.isAerialway;
        var disl;
        var pend;
        var dist = eDistance * 1000;
        if (dist == 0) {
            disl = 0;
            pend = 0;
        } else {
            disl = currentElev - prevElev;
            pend = disl / dist;
        }

        var tmpTime;
        if (usePiste) {
            tmpTime = dist / 20;
        } else {
            if (pend > 0.1 && pend < 0.2) {
                tmpTime = (dist + disl / 300) / 2;
                //tmpTime = (dist + disl / 300) / 6; //BIKE
            } else if (pend > 0.2) {
                tmpTime = dist / 1.25;
                //tmpTime = dist / 10; //BIKE
            } else if (pend < -0.1) {
                tmpTime = dist / 5;
                //tmpTime = dist / 10; //BIKE
            } else {
                tmpTime = dist / 3.5;
                //tmpTime = dist / 15; //BIKE
            }
        }

        if (isAerialway) {
            tmpTime = dist / 7.5;
            if (usePiste) {
                var aerialwayType = retPoint.params["aerialway"];
                if (aerialwayType == "gondola") {
                    tmpTime = dist / 18
                } else {
                    tmpTime = dist / 12
                }
            }
        }


        if (this.time.length > 0) {
            this.time.push(this.time[this.time.length - 1] + (tmpTime / 1000));
        }

        // if (this.timeBike.length > 0) {
        //     this.timeBike.push(this.timeBike[this.timeBike.length - 1] + (tmpTimeBike / 1000));
        // }

        // if (this.timeAerial.length > 0) {
        //     this.timeAerial.push(this.timeAerial[this.timeAerial.length - 1] + (tmpTimeAerial / 1000));
        // }

    }
}
