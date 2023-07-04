import mongoose, { Schema, Document } from "mongoose"

export interface IANodePiste extends Document {
    x: String;
    y: String;
    l: any[];
  }
  const ANodePisteSchema: Schema = new Schema({
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
  export default mongoose.model < IANodePiste > ("aNodesPiste", ANodePisteSchema)