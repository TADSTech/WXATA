import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

const XGrabberPage = () => {
  const { username } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    navigate(`/tv/tools/${username}`, { replace: true });
  }, [navigate, username]);

  return null;
};

export default XGrabberPage;
