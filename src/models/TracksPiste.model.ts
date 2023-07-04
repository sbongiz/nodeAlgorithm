import mongoose, { Schema, Document } from "mongoose"

export interface ITrackPiste extends Document {
    x: String;
    y: String;
    l: any[];
  }
  const TrackPisteSchema: Schema = new Schema({
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
  export default mongoose.model < ITrackPiste > ("tracksPiste", TrackPisteSchema)