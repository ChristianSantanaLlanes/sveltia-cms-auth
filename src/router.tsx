import { createBrowserRouter } from 'react-router-dom';
import RootLayout from '@/components/RootLayout';
import HomePage from '@/pages/home/HomePage';
import InventoryPage from '@/pages/inventory/InventoryPage';
import DesignPage from '@/pages/design/DesignPage';
import CheckoutPage from '@/pages/checkout/CheckoutPage';
import ConfirmationPage from '@/pages/checkout/ConfirmationPage';
import NotFoundPage from '@/pages/NotFoundPage';
import CarLab from '@/pages/lab/CarLab';

export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      { path: '/', element: <HomePage /> },
      { path: '/inventory', element: <InventoryPage /> },
      { path: '/design/:modelId', element: <DesignPage /> },
      { path: '/checkout', element: <CheckoutPage /> },
      { path: '/order/:orderId', element: <ConfirmationPage /> },
      { path: '/lab/cars', element: <CarLab /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
