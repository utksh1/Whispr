require("express");

const { createApp } = require("./src/create-server");

const { app } = createApp();

module.exports = app;
