import mongoose from 'mongoose';

const chatSchema = new mongoose.Schema({
  chatId: { type: String, required: true },
  name: { type: String, required: true },
  notes: String,
  configuration: { type: Object, required: true },
  codeSnippet: { type: String }
});

// Exporta el modelo usando export default
const ChatConfig = mongoose.model('ChatConfig', chatSchema);
export default ChatConfig;
