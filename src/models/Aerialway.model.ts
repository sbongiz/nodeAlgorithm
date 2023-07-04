import mongoose, { Schema, Document } from "mongoose"

export interface IAerialway extends Document {
    x: String;
    y: String;
    l: any[];
  }
  const AerialwaySchema: Schema = new Schema({
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
  export default mongoose.model < IAerialway > ("aerialway", AerialwaySchema)