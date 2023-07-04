
import mongoose, { Schema, Document } from "mongoose"

export interface IPointPiste extends Document {
    x: String;
    y: String;
    l: any;
  }
  const PointsPisteSchema: Schema = new Schema({
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
  export default mongoose.model < IPointPiste > ("pointsPiste", PointsPisteSchema)