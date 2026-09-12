import { createSlice } from '@reduxjs/toolkit';

const bookingSlice = createSlice({
  name: 'bookings',
  initialState: {
    items: [],
    isLoading: false,
    error: null,
  },
  reducers: {
    fetchBookingsStart: (state) => {
      state.isLoading = true;
      state.error = null;
    },
    fetchBookingsSuccess: (state, action) => {
      state.isLoading = false;
      state.items = action.payload;
    },
    fetchBookingsError: (state, action) => {
      state.isLoading = false;
      state.error = action.payload;
    },
    updateBooking: (state, action) => {
      const idx = state.items.findIndex((b) => b._id === action.payload._id);
      if (idx !== -1) state.items[idx] = action.payload;
      else state.items.unshift(action.payload);
    },
  },
});

export const { fetchBookingsStart, fetchBookingsSuccess, fetchBookingsError, updateBooking } = bookingSlice.actions;
export default bookingSlice.reducer;
