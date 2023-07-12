import { EntityTypeEnum } from "../enums/entityTypeEnum.enum";
import { PositionModelDto } from "../models/PositionModelDto";
import { AlgorithmRepository } from "../repository/algorithm.repository";
import { DijkstraService } from "./dijkstra.service";
import { MetricsService } from "./metrics.service";

export default {
    Dijkstra
  };

  interface IPathFindingInput {
    start: any;
    end: any;
    options: any;
}
  async function Dijkstra({
    start,
    end,
    options
  }: IPathFindingInput): Promise<any> {

    var algorithmRepository = new AlgorithmRepository();
    var metricsService = new MetricsService(); 
    var ds = new DijkstraService(algorithmRepository,metricsService);
    var startPo = new PositionModelDto(start[1],start[0]);
    var endPo = new PositionModelDto(end[1],end[0]);
    return ds.dijkstra(startPo,endPo,options);

    }