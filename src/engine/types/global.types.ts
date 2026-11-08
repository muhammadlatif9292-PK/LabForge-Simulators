// src/types/global.types.ts
export type ID = string;
export type Timestamp = number;
export type JSONValue = string | number | boolean | null | JSONObject | JSONArray;
export interface JSONObject { [key: string]: JSONValue }
export type JSONArray = JSONValue[];