import mongoose, { Schema, Document } from "mongoose"

export interface IANode extends Document {
    x: String;
    y: String;
    l: any[];
  }
  const ANodeSchema: Schema = new Schema({
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
  export default mongoose.model < IANode > ("aNodes", ANodeSchema)