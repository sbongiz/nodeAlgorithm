import mongoose, { Schema, Document } from "mongoose"

export interface INode extends Document {
    x: String;
    y: String;
    l: any[];
  }
  const NodeSchema: Schema = new Schema({
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
  export default mongoose.model < INode > ("nodes", NodeSchema)