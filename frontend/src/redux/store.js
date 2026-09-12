import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import userReducer from './slices/userSlice';
import loadsReducer from './slices/loadsSlice';
import bookingReducer from './slices/bookingSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    user: userReducer,
    loads: loadsReducer,
    bookings: bookingReducer,
  },
});

export default store;
