# Squeeze-Bot

This is the memestocks discord squeeze bot.

## Issues
Make sure you're tagging issues correctly when filing them. Bug, feature request, and discussion should be the main ones you use.

## Structure
Index.js has the discord bot commands.
Scraper/ contains the ortex website scraper.
Data/index.js is for the SQL server connection.
Data/insert.js handles inserting the ortex data into the database.
Data/stored_procedure.sql has all the logic for calculating the squeeze score.
