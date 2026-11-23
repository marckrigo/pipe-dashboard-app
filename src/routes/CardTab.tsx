import { useEffect, useState } from 'react';
import { usePipefyApp } from '../hooks/usePipefyApp';
import { useResize } from '../hooks/useResize';
import type { LoggedUser, PipefyAppInstance } from '../types/pipefy';

export function CardTab() {
  /**
   * You'll always need to call the following functions in order for your app to work properly.
   */
  const { pipefyApp, pipefyAppInstance } = usePipefyApp();
  useResize(pipefyApp);

  const [cardId, setCardId] = useState('loading...');
  const [cardTitle, setCardTitle] = useState('loading...');
  const [userData, setUserData] = useState<LoggedUser | undefined>();

  useEffect(() => {
    const getCardData = async (instance: PipefyAppInstance) => {
      /**
       * Here we're using Pipefy Client function to get the current card data
       * See https://developers.pipefy.com/docs/get-pipefy-data for more details and other functions
       */
      const cardData = await instance.card();
      setCardId(cardData.id);
      setCardTitle(cardData.title);

      /**
       * Here we're using the Functions API syntax to make requests directly to Pipefy's GraphQL
       * See https://developers.pipefy.com/docs/make-api-calls for more details and other functions
       */
      const meDataResponse = await instance.query<{ me: LoggedUser }>('{ me { name, avatarUrl } }');
      setUserData(meDataResponse.data.me);
    };

    if (pipefyApp && pipefyAppInstance) {
      /**
       * You'll always need to call `pipefyApp.render` to use the client functions
       */
      pipefyApp.render(() => {
        getCardData(pipefyAppInstance);
      });
    }
  }, [pipefyAppInstance, pipefyApp, cardId]);

  return (
    <>
      <h1>Hello World!</h1>
      <p>Welcome to the custom tab of this card!</p>

      <p>Did you know that you can make calls using the Functions API?</p>
      <p>See below an example component returned by an API call.</p>
      <ul>
        <li>
          This card ID: <strong>{cardId}</strong>
        </li>
        <li>
          This card Title: <strong>{cardTitle}</strong>
        </li>
      </ul>
      <p>Current logged in user data:</p>
      {userData && (
        <>
          <p>
            The current logged in user is:
            <img
              width="20px"
              height="20px"
              src={userData.avatarUrl}
              alt={`${userData.name} avatar`}
            />
            <strong>{userData.name}</strong>
          </p>
        </>
      )}
      <p>
        For more information, visit Pipefy&rsquo;s{' '}
        <a href="https://developers.pipefy.com/docs/make-api-calls" target="_blank">
          Functions API documentation
        </a>
        .
      </p>
    </>
  );
}
