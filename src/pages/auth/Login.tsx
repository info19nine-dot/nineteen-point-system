import { useNavigate } from 'react-router-dom';
import { useMock } from '../../contexts/MockContext';

const Login = () => {
  const { login } = useMock();
  const navigate = useNavigate();

  const handleLogin = async (role: 'member' | 'admin') => {
    await login(role);
    if (role === 'member') {
      navigate('/card');
    } else {
      navigate('/admin');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
        <h1 className="text-2xl font-bold mb-6 text-center text-teal-700">Loyalty Connect</h1>
        <div className="space-y-4">
          <button
            onClick={() => handleLogin('member')}
            className="w-full py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition"
          >
            会員としてログイン
          </button>
          <button
            onClick={() => handleLogin('admin')}
            className="w-full py-3 bg-gray-700 text-white rounded-lg hover:bg-gray-800 transition"
          >
            店舗スタッフとしてログイン
          </button>
        </div>
        <div className="mt-4 text-center">
            <span className="text-sm text-gray-500">新規登録は</span>
            <a href="/register" className="ml-1 text-sm text-teal-600 hover:underline">こちら</a>
        </div>
      </div>
    </div>
  );
};

export default Login;
