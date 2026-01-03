import { useEffect } from 'react';

/**
 * A hook to dynamically update the document title
 * @param title The title to set for the document
 */
export default function useDocumentTitle(title: string) {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = title;
    
    // Reset the title when the component unmounts
    return () => {
      document.title = previousTitle;
    };
  }, [title]);
}