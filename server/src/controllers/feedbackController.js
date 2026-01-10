import Feedback from '../models/Feedback.js';

export const submitFeedback = async (req, res) => {
  try {
    const { message, type } = req.body;

    if (!message) {
      return res.status(400).json({ message: 'Message is required' });
    }

    if (!req.user || !req.user._id) {
        console.error('User not found in request object');
        return res.status(401).json({ message: 'User not authenticated' });
    }

    const newFeedback = new Feedback({
      userId: req.user._id, // Fixed: Access Mongoose ID correctly
      message,
      type: type || 'other'
    });

    try {
        await newFeedback.save();
    } catch (saveError) {
        console.error('Error Saving Feedback:', saveError);
        throw saveError; // Re-throw to be caught by outer catch
    }

    res.status(201).json({ message: 'Feedback submitted successfully', feedback: newFeedback });
  } catch (error) {
    console.error('Error submitting feedback (Main Catch):', error);
    res.status(500).json({ message: 'Server error while saving feedback', error: error.message });
  }
};

export const getAllFeedback = async (req, res) => {
  try {
    const feedbacks = await Feedback.find()
      .populate('userId', 'username role')
      .sort({ createdAt: -1 });

    res.status(200).json(feedbacks);
  } catch (error) {
    console.error('Error fetching feedback:', error);
    res.status(500).json({ message: 'Server error while fetching feedback' });
  }
};
