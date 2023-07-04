import mongoose, { Schema, Document } from "mongoose"

export interface ITrack extends Document {
    x: String;
    y: String;
    l: any[];
  }
  const TrackSchema: Schema = new Schema({
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
  export default mongoose.model < ITrack > ("tracks", TrackSchema)