import mongoose from 'mongoose';

async function main() {
    await mongoose.connect('mongodb://127.0.0.1:27017/medicine-requirement-system');
    const User = mongoose.model('User', new mongoose.Schema({ username: String, role: String }, { strict: false }));
    const users = await User.find({});
    console.log("All users:", users);
    process.exit(0);
}

main().catch(console.error);
