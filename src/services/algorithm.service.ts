import { EntityTypeEnum } from "../enums/entityTypeEnum.enum";
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
    ds.dijkstra(start,end,options);

    }