import mongoose, { Schema, Document } from "mongoose"

export interface IStation extends Document {
    x: String;
    y: String;
    l: any[];
  }
  const StationSchema: Schema = new Schema({
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
  export default mongoose.model < IStation > ("station", StationSchema)