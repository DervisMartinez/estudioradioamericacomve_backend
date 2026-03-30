const express = require('express');
const router = express.Router();
const videoController = require('../controllers/videoController');

router.get('/', videoController.getAllVideos);
router.post('/', videoController.createVideo);
router.put('/:id', videoController.updateVideo);
router.delete('/:id', videoController.deleteVideo);
router.post('/:id/view', videoController.incrementView);

module.exports = router;