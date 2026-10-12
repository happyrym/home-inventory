export type PlaceKind = 'room' | 'furniture' | 'section' | 'container';

export interface Place {
  id: string;
  name: string;
  parentId: string | null;
  kind: PlaceKind;
  order: number;
  updatedAt: number;
}

export interface Item {
  id: string;
  name: string;
  aliases: string[];
  placeId: string | null;
  qty: number;
  note: string;
  updatedAt: number;
}

export type NetKind = 'v4' | 'v6-64';

export interface AllowedNetwork {
  addr: string;
  kind: NetKind;
  label: string;
  addedAt: number;
}

export interface Household {
  name: string;
  allowedNetworks?: AllowedNetwork[];
  createdAt: number;
}

export interface SeedNode {
  name: string;
  kind: PlaceKind;
  children?: SeedNode[];
}
