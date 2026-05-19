const axios = require('axios');

async function test() {
  try {
    const res = await axios.post('http://localhost:3000/graphql', {
      query: `mutation UpdateListing($id: String!, $input: UpdateListingInput!) {
        updateListing(id: $id, input: $input) {
          id
        }
      }`,
      variables: {
        id: "abc",
        input: {
          title: "Test",
          description: "Test Desc",
          type: "EVENT",
        }
      }
    });
    console.log(JSON.stringify(res.data, null, 2));
  } catch (e) {
    if (e.response) {
      console.error(JSON.stringify(e.response.data, null, 2));
    } else {
      console.error(e.message);
    }
  }
}
test();
