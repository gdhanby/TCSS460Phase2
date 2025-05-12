# Group1 Web API

Live: https://tcss460-group1-web-api-d9b1e8b26f0f.herokuapp.com/
Docs: https://gdhanby.github.io/TCSS460Phase2/

### Alpha Sprint Contribution

- Gage: Set up Heroku, hosted the web service
- Noah: Troubleshooting
- Ian: N/A
- Christian: N/A

### Alpha Sprint Meetings

The primary form of communication is was through Discord text and voice channels

### Alpha Sprint Comments

N/A

### Beta Sprint Contribution

- Gage: Initial draft of Postman tests, lots of database stuff
- Noah: Lots of database stuff, create book route, general polish on testing/docs/routes
- Ian: Worked on retrieve by isbn/author routes
- Christian: Worked on retrieve by isbn/author routes & initial documentation draft

### Beta Sprint Meetings

Thrice-weekly meetings over Discord, attendance was good. Calls would start with discussions of what needs to be done and then usually a couple hours of pair programming and work. Steady text-based communuication as well.

### Beta Sprint Comments

Ideas: Want to break out mwValidBookEntry into different pieces to be able to give more detailed feedback on missing/malformed input. This is a somewhat tedious undertaking though.
Weirdness/notes: API accepts isbn13 as either a string or a number. API always returns it as a string, however. API also always returns rating average as a numeric string, which is documented. Anyways, below is the ER diagram for our DB.
<img src="https://github.com/user-attachments/assets/6d19a5a6-eb4e-4195-9bba-82e6ee4ace14" width=574px height=344px>

### Beta II Sprint Contribution

- Gage: Worked on change password & update ratings routes. Also did documentation for them
- Noah: Cursor & offset pagination impl. & documentation. All tests. General fixes
- Ian: Worked on change password & cursor pagination routes
- Christian: Bugfixes on update ratings route, help w/ offset pagination

### Beta II Sprint Meetings

The normal meetings over discord along with the in-person meeting on Tuesday the 29th.

### Beta II Sprint Comments

None.

### Published web API Production version sprint contribution
- Gage: Worked on lookup by year range route and QA testing
- Noah: Worked on fetch by title route, fetch by ratings route, testing
- Ian: Worked on delete by title
- Christian: Worked on delete by ISBN

### Published web API Production version sprint meetings
The normal meetings over discord for monday and wednesday. Small meeting on Saturday due to Mothers day plans

### Published web API Production version sprint comments
None.
