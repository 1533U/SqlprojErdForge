declare module "elkjs" {
  export interface ElkPoint {
    x: number;
    y: number;
  }

  export interface ElkNode {
    id: string;
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    children?: ElkNode[];
    layoutOptions?: Record<string, string>;
  }

  export interface ElkExtendedEdge {
    id: string;
    sources: string[];
    targets: string[];
  }

  export interface ELK {
    layout<T extends ElkNode>(graph: T): Promise<T>;
  }

  export default class ElkConstructor {
    constructor();
    layout: ELK["layout"];
  }
}
