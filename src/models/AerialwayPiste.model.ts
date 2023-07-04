
import mongoose, { Schema, Document } from "mongoose"

export interface IAerialwayPiste extends Document {
    x: String;
    y: String;
    l: any[];
  }
  const AerialwayPisteSchema: Schema = new Schema({
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
  export default mongoose.model < IAerialwayPiste > ("aerialwayPiste", AerialwayPisteSchema)