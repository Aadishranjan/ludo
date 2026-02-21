const router = require("express").Router();
const ludoController = require('../controllers/ludoController')

router
    .route('/')
    .get(ludoController.root);

router
    .route('/:ROOMCODE/game')
    .get(ludoController.game);

router
    .route('/:ROOMCODE')
    .get(ludoController.room);

module.exports = router;
