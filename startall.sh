#!/bin/bash
node main_app.js &
node customerservice_app.js &
node authservice_app.js &
node flightservice_app.js &
node bookingservice_app.js
