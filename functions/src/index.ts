import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as express from 'express';
import * as bodyParser from 'body-parser';

// // Start writing Firebase Functions
// // https://firebase.google.com/docs/functions/typescript

admin.initializeApp(functions.config().firebase);
const fireStore = admin.firestore();

const time_to_expire_skyway_id = 604800;
const COLLECTION_WAITERS = 'waiters_test'

const app = express();

app.use(bodyParser.json());

app.get('/', (req, res) => {
  res.send({'status': 'ok'})
});

app.get('/waiters', (req, res) => {
  console.log('GET /waiters');

  // returns valid skyway_ids
  fireStore.collection(COLLECTION_WAITERS)
    .where('expired_at', '>', admin.firestore.Timestamp.fromDate(new Date(Date.now())))
    .orderBy('expired_at', 'desc')
    .get()
    .then(querySnapshot => {
      const rets: any = [];
      querySnapshot.forEach(doc => {
        rets.push({
          'skyway_id': doc.id
          ,doc: doc.data()
        });
      })
      res.send(rets);
    })
    .catch(err => {
      res.send({
        status: 'query error',
        response: err
      });
    });
});

/**
 * URL: /waiters
 * method: POST
 */
app.post('/waiters', (req, res) => {
  console.log(req.body);
  const skyway_id = req.body.skyway_id;
  const phi :number = req.body.phi;
  const theta :number = req.body.theta;

  // update firestore.
  add_waiter(skyway_id, phi, theta, (ret: any) => {
    fireStore.collection(COLLECTION_WAITERS)
    .where('expired_at', '>', admin.firestore.Timestamp.fromDate(new Date(Date.now())))
    .where('phi', '==', phi)
    .where('theta', '==', theta)
    .orderBy('expired_at', 'desc')
    .get()
    .then(querySnapshot => {
      if (querySnapshot.empty) {
        console.log('Empty QuerySnapshot');
        res.send({
          status: 'keep waiting.'
          ,skyway_id: null
        })
      } else {
        console.log("At least 1 document was found.");
        let noDocFound: Boolean = true;
        querySnapshot.forEach((doc) => {
          console.log(doc.data().skyway_id + ' ' + skyway_id);
          if (doc.data().skyway_id === skyway_id) {
            // continue
          } else {
            noDocFound = false;
            res.send({
              status: 'found.'
              ,skyway_id: doc.id
              ,doc: doc.data()
            });
          }
        });
        if (noDocFound) {
          res.send({
            status: 'keep waiting.'
            ,skyway_id: null
          });
        }
      }
    })
    .catch(err => {
      res.send({
        status: 'query error',
        response: err
      });
    });
  });
});

function add_waiter(skyway_id: string, phi: number, theta: number, callback: Function): any {
  const expire_date = new Date();
  expire_date.setSeconds(expire_date.getSeconds() + time_to_expire_skyway_id);

  // create new record.
  const data = {
    skyway_id: skyway_id
    ,phi: phi
    ,theta: theta
    ,created_at: new Date(Date.now())
    ,expired_at: admin.firestore.Timestamp.fromDate(expire_date)
  }
  console.log(data);
  fireStore.collection(COLLECTION_WAITERS)
    .doc(skyway_id)
    .set(data)
    .then(result => {
      console.log('Set document succeeded.');
      const ret = {
        status: 200
        ,response: {
          status: 'keep wait.'
          ,skyway_id: null
          ,created_data: data
          ,response: result
        }
      }
      callback(ret);
    })
    .catch(err => {
      console.log('Set document failed.');
      const ret = {
        status: 400
        ,response: {
          status: 'error',
          response: err
        }
      }
      callback(ret);
    });
}

app.delete('/waiters', (req, res) => {
  const skyway_id = req.body.skyway_id;
  console.log('delete skyway_id: ' + skyway_id);

  fireStore.collection(COLLECTION_WAITERS)
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