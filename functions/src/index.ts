import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as express from 'express';
import * as bodyParser from 'body-parser';

// // Start writing Firebase Functions
// // https://firebase.google.com/docs/functions/typescript

admin.initializeApp(functions.config().firebase);
const fireStore = admin.firestore();

const app = express();

app.use(bodyParser.json());

app.get('/', (req, res) => {
  res.send({'status': 'ok'})
});

/**
 * URL: /waiters
 * method: POST
 */
app.post('/waiters', (req, res) => {
  console.log(req.body);
  const skyway_id = req.body.skyway_id;
  let expire_date = new Date();
  expire_date.setSeconds(expire_date.getSeconds() + 60);

  // search firestore;
  fireStore.collection('waiters_test')
    .where('expired_at', '>', admin.firestore.Timestamp.fromDate(new Date(Date.now())))
    .get()
    .then(querySnapshot => {
      if (querySnapshot.empty) {
        // create new record.
        const data = {
          skyway_id: skyway_id
          ,expired_at: admin.firestore.Timestamp.fromDate(expire_date)
        }
        fireStore.collection('waiters_test')
          .doc(skyway_id)
          .set(data)
          .then(result => {
            res.send({
              status: 'keep wait.'
              ,skyway_id: null
              ,created_data: data
              ,response: result
            });
          })
          .catch(err => {
            res.status(400)
              .send({
                status: 'error',
                response: err
              });
          })
      } else {
        // docs more than 1 was found.
        querySnapshot.forEach(doc => {
          res.send({
            status: 'found.'
            ,skyway_id: doc.id
            ,doc: doc.data()
          });
        });
      }
    })
    .catch(err => {
      res.send({
        status: 'query error',
        response: err
      });
    });
});

app.delete('/waiters', (req, res) => {
  const skyway_id = req.body.skyway_id;
  console.log('delete skyway_id: ' + skyway_id);

  fireStore.collection('waiters_test')
    .doc(skyway_id)
    .delete()
    .then(result => {
      res.send({
        status: 'successfully deleted.'
        ,response: result
      });
    })
    .catch(err => {
      res.status(400)
        .send({
          status: 'error occured.'
          ,response: err
        });
    });
})

exports.v1 = functions.https.onRequest(app);