import React from 'react';
import { ErrorNotice, Loading } from '../ui.jsx';

export default function ResourceState({ resource, children }) {
  if (resource.loading) {
    return <Loading />;
  }

  if (resource.error) {
    return <ErrorNotice error={resource.error} retry={resource.retry} />;
  }

  return children(resource.data);
}
