-- El valor nuevo no se puede usar en la misma transacción que lo crea.
-- El acceso queda en la migración siguiente.
alter type public.user_role add value if not exists 'politico';
