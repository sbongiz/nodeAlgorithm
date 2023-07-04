import mongoose, { Schema, Document } from "mongoose"

export interface IStationPiste extends Document {
    x: String;
    y: String;
    l: any[];
  }
  const StationPisteSchema: Schema = new Schema({
    x: {
      type: String,
      required: true,
    },
    y: {
      type: String,
      required: true,
    },
    l: {
      type: [],
      required: true,
    },
  })
  export default mongoose.model < IStationPiste > ("stationPiste", StationPisteSchema)