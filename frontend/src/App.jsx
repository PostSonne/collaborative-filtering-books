import React, {useEffect, useState} from 'react';
import axios from 'axios';
import {
    Avatar,
    Box,
    Button,
    Card,
    CardActions,
    CardContent,
    Chip,
    Container,
    Divider,
    FormControl,
    Grid,
    InputLabel,
    List,
    ListItem,
    ListItemAvatar,
    ListItemText,
    MenuItem,
    Paper,
    Select,
    styled,
    Typography
} from "@mui/material";
import {
    PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

function App() {
    const [userId, setUserId] = useState(null);
    const [loggedUser, setLoggedUser] = useState(null);
    const [users, setUsers] = useState([]);
    const [countries, setCountries] = useState([]);
    const [modelEval, setModelEval] = useState(null);
    const [modelEvalWithout, setModelEvalWithout] = useState(null);
    const [modelEval07, setModelEval07] = useState(null);
    const [books, setBooks] = useState([]);
    const [recommendations, setRecommendations] = useState([]);
    const [recommendationsWithout, setRecommendationsWithout] = useState([]);

    const Item = styled(Paper)(({theme}) => ({
        backgroundColor: '#fff',
        ...theme.typography.body2,
        padding: theme.spacing(1),
        textAlign: 'center',
        color: (theme.vars ?? theme).palette.text.secondary,
        ...theme.applyStyles('dark', {
            backgroundColor: '#1A2027',
        }),
    }));

    const selectUser = (event) => {
        setUserId(event.target.value);
        setRecommendations([]);
        setRecommendationsWithout([]);
        setBooks([]);
    };


    const loadUserData = () => {
        setLoggedUser(userId);
        axios.get(`http://localhost:3001/predict/${userId}`).then(res => {
            console.log(res);
            setBooks(res.data.predictions);
            setRecommendations(res.data.recommended);
            setRecommendationsWithout(res.data.recommendedWithout);
            console.log(recommendations);
        });
    }

    const loginCard = <Card sx={{minWidth: 275}}>
        <CardContent>
            <Typography gutterBottom sx={{color: 'text.primary', fontSize: 18}}>
                Login Form
            </Typography>
            <FormControl fullWidth>
                <InputLabel id="demo-simple-select-label">User Id</InputLabel>
                <Select
                    labelId="demo-simple-select-label"
                    id="demo-simple-select"
                    value={userId}
                    label="Selected User"
                    onChange={selectUser}
                >
                    {users.map(item => <MenuItem value={item}>User Id {item}</MenuItem>)}
                </Select>
            </FormControl>
        </CardContent>
        <CardActions>
            <Button onClick={() => loadUserData()} variant="contained" size="small">Access</Button>
        </CardActions>
    </Card>;

    const userCard = <Card sx={{minWidth: 275}}>
        <CardContent>
            <Typography gutterBottom sx={{color: 'text.primary', fontSize: 18}}>
                User {loggedUser}
            </Typography>
        </CardContent>
        <CardActions>
            <Button onClick={() => setLoggedUser(null)} variant="contained" size="small">Logout</Button>
        </CardActions>
    </Card>;

    useEffect(() => {
        axios.get('http://localhost:3001/ratings').then(res => {
            setUsers(res.data.slice(0, 20));
        });
    }, []);

    useEffect(() => {
        axios.get('http://localhost:3001/countries').then(res => {
            setCountries(res.data);
        });
    }, []);

    useEffect(() => {
        axios.get('http://localhost:3001/evaluate').then(res => {
            setModelEval(res.data);
        });
    }, []);
    useEffect(() => {
        axios.get('http://localhost:3001/evaluate_without').then(res => {
            setModelEvalWithout(res.data);
        });
    }, []);
    useEffect(() => {
        axios.get('http://localhost:3001/evaluate07').then(res => {
            setModelEval07(res.data);
        });
    }, []);

    const filteredData = countries.filter(d => d.country && d.country !== "null");

    const sorted = [...filteredData].sort((a, b) => b.count - a.count);
    const top10 = sorted.slice(0, 10);

    const othersCount = sorted.slice(10).reduce((sum, item) => sum + item.count, 0);
    const dataWithOthers = [...top10];
    if (othersCount > 0) {
        dataWithOthers.push({country: "Others", count: othersCount});
    }
    console.log(dataWithOthers);

    const COLORS = [
        '#0088FE', '#00C49F', '#FFBB28', '#FF8042',
        '#A28CFF', '#FF6E6E', '#82CA9D', '#8884D8',
        '#FFC658', '#AAFF99', '#999999'
    ];

    const CountryPieChart = () => (<div className="p-4">
        <h2 className="text-xl font-bold mb-4">Country Representation (Top 10 + Others)</h2>
        <div style={{height: 500}}>
            <ResponsiveContainer>
                <PieChart>
                    <Pie
                        data={dataWithOthers}
                        dataKey="count"
                        nameKey="country"
                        cx="50%"
                        cy="50%"
                        outerRadius={90}
                        label
                    >
                        {dataWithOthers.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]}/>
                        ))}
                    </Pie>
                    <Tooltip/>
                    <Legend/>
                </PieChart>
            </ResponsiveContainer>
        </div>
    </div>);

    return (
        <Container maxWidth="lg">
            <div className="p-4">
                <h1 className="text-2xl font-bold mb-4">Cross-Cultural Book Recommender</h1>
                {/*{!userId && <Grid container spacing={2}>
                <Grid size={8}>
                    <Item>size=8</Item>
                </Grid>
                <Grid size={4}>
                    <Item>size=4</Item>
                </Grid>
                <Grid size={4}>
                    <Item>size=4</Item>
                </Grid>
                <Grid size={8}>
                    <Item>size=8</Item>
                </Grid>
            </Grid>}*/}
                {loggedUser &&
                    <div className="grid grid-cols-2 gap-4">
                        <Grid container spacing={2}>
                            <Grid size={12}>
                                {userCard}
                            </Grid>
                            <Grid size={9}>
                                <Grid container spacing={2}>
                                    <Grid size={4}>
                                        <CardContent>
                                            <Typography gutterBottom sx={{color: 'text.primary', fontSize: 18}}>
                                                Evaluation of Diversity 0.3
                                            </Typography>
                                            <Typography gutterBottom sx={{color: 'text.primary', fontSize: 12}}>
                                                MAE: {modelEval07?.MAE}
                                            </Typography>
                                            <Typography gutterBottom sx={{color: 'text.primary', fontSize: 12}}>
                                                RMSE: {modelEval07?.RMSE}
                                            </Typography>
                                        </CardContent>
                                    </Grid>
                                    <Grid size={4}>
                                        <CardContent>
                                            <Typography gutterBottom sx={{color: 'text.primary', fontSize: 18}}>
                                                Evaluation of Diversity 0.2
                                            </Typography>
                                            <Typography gutterBottom sx={{color: 'text.primary', fontSize: 12}}>
                                                MAE: {modelEval?.MAE}
                                            </Typography>
                                            <Typography gutterBottom sx={{color: 'text.primary', fontSize: 12}}>
                                                RMSE: {modelEval?.RMSE}
                                            </Typography>
                                        </CardContent>
                                    </Grid>
                                    <Grid size={4}>
                                        <CardContent>
                                            <Typography gutterBottom sx={{color: 'text.primary', fontSize: 18}}>
                                                Evaluation without Diversity
                                            </Typography>
                                            <Typography gutterBottom sx={{color: 'text.primary', fontSize: 12}}>
                                                MAE: {modelEvalWithout?.MAE}
                                            </Typography>
                                            <Typography gutterBottom sx={{color: 'text.primary', fontSize: 12}}>
                                                RMSE: {modelEvalWithout?.RMSE}
                                            </Typography>
                                        </CardContent>
                                    </Grid>
                                    <Grid size={4}>
                                        <div>My Rated books:</div>
                                        <List sx={{width: '100%', maxWidth: 360, bgcolor: 'background.paper'}}>
                                            {books.map(item => (
                                                <>
                                                    <ListItem alignItems="flex-start">
                                                        <ListItemAvatar>
                                                            <Avatar alt={item.title} src={item.image}
                                                                    sx={{width: 56, height: 56}}/>
                                                        </ListItemAvatar>
                                                        <ListItemText
                                                            sx={{ml: 2}}
                                                            primary={item.title}
                                                            secondary={
                                                                <React.Fragment>
                                                                    <Typography>My Rating: {item.actualRating}</Typography>
                                                                    <Typography>Predicted
                                                                        Rating: {item.predictedRating}</Typography>
                                                                    <Box sx={{display: 'flex', flexWrap: 'wrap', gap: 1}}>
                                                                        {[...new Set(item.country?.filter(Boolean))].map((country, idx) => (
                                                                            <Chip key={idx} label={country} size="small"/>
                                                                        ))}
                                                                    </Box>
                                                                </React.Fragment>
                                                            }
                                                        />
                                                    </ListItem>
                                                    <Divider variant="inset" component="li"/>
                                                </>
                                            ))}
                                        </List>
                                    </Grid>
                                    <Grid size={4}>
                                        <div>Recommendations 0.2:</div>
                                        <List sx={{width: '100%', maxWidth: 360, bgcolor: 'background.paper'}}>
                                            {recommendations.map(item => (
                                                <>
                                                    <ListItem alignItems="flex-start">
                                                        <ListItemAvatar>
                                                            <Avatar alt={item.title} src={item.image}
                                                                    sx={{width: 56, height: 56}}/>
                                                        </ListItemAvatar>
                                                        <ListItemText
                                                            sx={{ml: 2}}
                                                            primary={item.title}
                                                            secondary={
                                                                <React.Fragment>
                                                                    <Typography>Predicted Rating: {item.predictedRating}</Typography>
                                                                    <Box sx={{display: 'flex', flexWrap: 'wrap', gap: 1}}>
                                                                        {[...new Set(item.country?.filter(Boolean))].map((country, idx) => (
                                                                            <Chip key={idx} label={country} size="small"/>
                                                                        ))}
                                                                    </Box>
                                                                </React.Fragment>
                                                            }
                                                        />
                                                    </ListItem>
                                                    <Divider variant="inset" component="li"/>
                                                </>
                                            ))}
                                        </List>
                                    </Grid>
                                    <Grid size={4}>
                                        <div>Recommendations without diversity:</div>
                                        <List sx={{width: '100%', maxWidth: 360, bgcolor: 'background.paper'}}>
                                            {recommendationsWithout.map(item => (
                                                <>
                                                    <ListItem alignItems="flex-start">
                                                        <ListItemAvatar>
                                                            <Avatar alt={item.title} src={item.image}
                                                                    sx={{width: 56, height: 56}}/>
                                                        </ListItemAvatar>
                                                        <ListItemText
                                                            sx={{ml: 2}}
                                                            primary={item.title}
                                                            secondary={
                                                                <React.Fragment>
                                                                    <Typography>Predicted Rating: {item.predictedRating}</Typography>
                                                                    <Box sx={{display: 'flex', flexWrap: 'wrap', gap: 1}}>
                                                                        {[...new Set(item.country?.filter(Boolean))].map((country, idx) => (
                                                                            <Chip key={idx} label={country} size="small"/>
                                                                        ))}
                                                                    </Box>
                                                                </React.Fragment>
                                                            }
                                                        />
                                                    </ListItem>
                                                    <Divider variant="inset" component="li"/>
                                                </>
                                            ))}
                                        </List>
                                    </Grid>
                                </Grid>
                            </Grid>
                            <Grid size={3}>
                                <CountryPieChart/>
                            </Grid>
                        </Grid>
                        {/*<div>
                        <h2 className="font-semibold mb-2">Select book:</h2>
                        <ul>
                            {books.slice(0, 20).map(book => (
                                <li key={book.id}>
                                    <button
                                        onClick={() => handleSelect(book)}
                                        className="text-blue-600 hover:underline"
                                    >
                                        {book.title} — {book.author}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </div>
                    <div>
                        {selectedBook && (
                            <>
                                <h2 className="font-semibold mb-2">Рекомендации для: {selectedBook.title}</h2>
                                <ul>
                                    {recommendations.map(book => (
                                        <li key={book.id}>{book.title} — {book.author}</li>
                                    ))}
                                </ul>
                            </>
                        )}
                    </div>*/}
                    </div>}
            </div>
            <Container maxWidth="sm">
                {!loggedUser && loginCard}
            </Container>
        </Container>
    );
}

export default App;