import { createSlice } from '@reduxjs/toolkit';

const loadsSlice = createSlice({
  name: 'loads',
  initialState: {
    items: [],
    isLoading: false,
    error: null,
  },
  reducers: {
    fetchLoadsStart: (state) => {
      state.isLoading = true;
      state.error = null;
    },
    fetchLoadsSuccess: (state, action) => {
      state.isLoading = false;
      state.items = action.payload;
    },
    fetchLoadsError: (state, action) => {
      state.isLoading = false;
      state.error = action.payload;
    },
    addLoad: (state, action) => {
      state.items.unshift(action.payload);
    },
    updateLoad: (state, action) => {
      const idx = state.items.findIndex((l) => l._id === action.payload._id);
      if (idx !== -1) state.items[idx] = action.payload;
    },
  },
});

export const { fetchLoadsStart, fetchLoadsSuccess, fetchLoadsError, addLoad, updateLoad } = loadsSlice.actions;
export default loadsSlice.reducer;
