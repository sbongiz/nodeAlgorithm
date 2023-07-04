import mongoose, { Schema, Document } from "mongoose"

export interface IPoint extends Document {
    x: String;
    y: String;
    l: any;
  }
  const PointsSchema: Schema = new Schema({
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
  export default mongoose.model < IPoint > ("points", PointsSchema)