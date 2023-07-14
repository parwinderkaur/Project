'use strict'
const User = use('App/Models/User')
const Helpers = use('Helpers')
const {validateAll} = use('Validator')
const BaseController = use('App/Controllers/Http/BaseController')
const UserInterest = use('App/Models/UserInterest')
const AssignedMentor = use('App/Models/AssignedMentor')
const Rating = use('App/Models/Rating')
const InterestMaster = use('App/Models/InterestMaster')
const UserGoal = use('App/Models/UserGoal')
const UserTask = use('App/Models/UserTask')
const GoalCategory = use('App/Models/GoalCategory')
const Calendar = use('App/Models/MentorCalendar');
const UserSubscription = use('App/Models/UserSubscription');
const Appointment = use('App/Models/Appointment');
const UserCertification = use('App/Models/UserCertification');
const UserExperience = use('App/Models/UserExperience');
const UserEducation = use('App/Models/UserEducation');
const UserAchievement = use('App/Models/UserAchievement');
const UserProject = use('App/Models/UserProject');
const UserStartup = use('App/Models/UserStartup');
const UserStartupCategory = use('App/Models/UserStartupCategory');
const PositionOfResponsibility = use('App/Models/PositionOfResponsibility');
const OrgMaster = use('App/Models/OrgMaster');
const UserProfile = use("App/Models/UserProfile");
const Env = use('Env')
const Redis = use('Redis')
const password = require('secure-random-password');
const moment = require('moment')
const Event = use('Event')
const Database = use('Database')
const sgMail = require('@sendgrid/mail');
sgMail.setApiKey(process.env.SENDGRID_API_KEY);
var jwt = require('jsonwebtoken');
const Mail = use('Mail')
const _ = require('lodash');
var md5 = require("md5");
const Sms = use('Sms')
const twilioOTP = use('App/utils/twilioOtp');
const UserAuthentication = use('App/Models/UserAuthentication')

class UserController extends BaseController {


    async getUser({request, response, auth}) {
        var mentorUser = {};
        if (auth.user.user_type == "MENTEE") {
            var user = await User.findBy({id: auth.user.id});
            var userDetail = await user.detail().fetch();
            var goals = await UserGoal.query().where({user_id: auth.user.id}).fetch();
            goals = goals.toJSON();
            var count = 0;
            for (var i = 0; i < goals.length; i++) {
                if (goals[i].goal_completion_status == 1) {
                    count++;
                }
            }
            var onGoingGoals = goals.length - count;
            var goal_id = _.map(goals, 'id');
            var userTask = await UserTask.query().whereIn('user_goal_id', goal_id).fetch();
            for (var i = 0; i < goals.length; i++) {
                if (goals[i].category_id != null) {
                    var category = await GoalCategory.query().where({'id': goals[i].category_id}).fetch();
                    category = category.toJSON();
                    goals[i].category = category[0].category;
                } else {
                    goals[i].category = "CUSTOM_GOAL";
                }
                var task = await UserTask.query().where({
                    user_goal_id: goals[i].id,
                    status: 'COMPLETED'
                }).sum('task_score as progress');
                goals[i].progress = task[0].progress;
            }
            userDetail = (userDetail && Object.keys(userDetail).length) ? userDetail.toJSON() : {};
            var combined = {...user.toJSON(), ...userDetail};
            combined = _.pick(combined, ['username', 'email', 'first_name', 'last_name', 'gender', 'user_type', 'user_category', 'mobile_no', 'date_of_birth', 'maritial_status', 'pincode', 'university_name', 'highest_education', 'passing_year']);
            var mentorlist = await user.assignedMentors().orderBy('created_at', 'desc').fetch();
            mentorlist = mentorlist.toJSON();
            if (mentorlist.length != 0) {
                var mentorUser = await User.query().where({id: mentorlist[0].mentor_id}).with('detail').fetch();
                var curentlyCoaching = await AssignedMentor.query().where({mentor_id: mentorlist[0].mentor_id}).count('mentor_id as total');
                if (!curentlyCoaching[0].total) {
                    var totalCoached = 0;
                } else {
                    var totalCoached = curentlyCoaching[0].total;
                }
                var rating = await Rating.query().where({user_id: mentorlist[0].mentor_id}).count('user_id as total').avg('rating as rating');
                var mentorRating = Math.floor(rating[0].rating || 0);
                var menteerating = await Rating.query().where({user_id: auth.user.id}).count('user_id as total').avg('rating as rating');
                var menteeRating = Math.floor(menteerating[0].rating || 0);
                var totalRating = rating[0].total;
            }
        } else {
            var user = await User.findBy({id: auth.user.id});
            var userDetail = await user.detail().fetch() || {};
            var menteelist = await AssignedMentor.query().with('user.detail').where({"mentor_id": auth.user.id}).fetch();
            userDetail = (userDetail && Object.keys(userDetail).length) ? userDetail.toJSON() : {};
            var combined = {...user.toJSON(), ...userDetail};
            combined = _.pick(combined, ['username', 'email', 'first_name', 'last_name', 'gender', 'user_type', 'user_category', 'mobile_no', 'date_of_birth', 'maritial_status', 'pincode', 'university_name', 'highest_education', 'passing_year']);
            var goals = [];
            let fromDate = moment().subtract(7, 'd').format('YYYY-MM-DD');
            let toDate = moment().format('YYYY-MM-DD');
            var totalEarning = await Appointment.query().where({
                mentor_id: auth.user.id,
                status: 'COMPLETED'
            }).where(Database.raw(`DATE(created_at) BETWEEN '${fromDate}' AND '${toDate}'`)).sum('price as totalEarning');
            totalEarning = {
                totalEarning: totalEarning[0].totalEarning || 0,
                fromDate: fromDate,
                toDate: toDate
            };
            var curentlyCoaching = await AssignedMentor.query().where({mentor_id: auth.user.id}).count('mentor_id as total');
            if (!curentlyCoaching[0].total) {
                var totalCoached = 0;

            } else {
                var totalCoached = curentlyCoaching[0].total;
            }
            var rating = await Rating.query().where({user_id: auth.user.id}).count('user_id as total').avg('rating as rating');
            var menteeRating = Math.floor(rating[0].rating || 0);
            var totalRating = rating[0].total;
        }
        const length = Object.keys(combined).length;
        var _w = 100 / length;
        var _c = _.pickBy(combined, _.identity);
        let _l = Object.keys(_c).length;
        let prfPercentage = Math.ceil(_l * _w);
        let subscribedTo = await UserSubscription.query().where({user_id: auth.user.id}).fetch();
        let user_mood = await Redis.get('USER_MOOD_' + auth.user.id) || null;
        if (user.country_id) {
            let country = await Database.select('phonecode').from('country').where( 'id',user.country_id);
            user.phonecode=country[0].phonecode;
        }
        let data = {
            userDetail, profileCompletion: prfPercentage,
            menteerating: menteeRating,
            user: user,
            ratingbytotal: totalRating,
            mentor: mentorUser || {},
            totalCoached: 0,
            curentlyCoaching: totalCoached,
            mentorRating: mentorRating,
            earning: totalEarning || {},
            menteelist: menteelist,
            goals: goals,
            totalGoals: goals.length,
            totalCompletedGoals: count,
            onGoingGoals: onGoingGoals,
            userTask: userTask,
            userSubscription: subscribedTo,
            user_mood: user_mood
        }
        var rating = await Rating.query().where({user_id: auth.user.id}).fetch();
        rating = rating.toJSON();
        var value = _.meanBy(rating, (p) => p.rating) || 0;
        const ratedByCount = rating.length;
        data.rating = {
            value,
            ratedByCount
        };
        return response.status(200).send({
            status: true,
            data: data
        })
    }
    async getUserProfile({request, response, auth}) {
        let user = await User.findBy({id: auth.user.id});
        let userDetail = await user.detail().fetch() || {};
        let userInterest = (user) ? await user.userInterest().fetch() : {};
        let userCertification = (user) ? await user.user_certification().fetch() : {};
        let userEducation = (user) ? await user.user_education().fetch() : {};
        let userExperiences = (user) ? await user.user_experiences().fetch() : {};
        let userAchievement = (user) ? await user.user_achievement().fetch() : {};
        let userProject = (user) ? await user.user_project().fetch() : {};
        let positionOfResponsibility = (user) ? await user.position_of_responsibility().fetch() : {};
        let userStartup = (user) ? await user.user_startup().fetch() : {};
        let userStartupCategory = (user) ? await user.user_startup_category().fetch() : {};

        if (user.country_id) {
            let country = await Database.select('phonecode').from('country').where( 'id',user.country_id);
            user.phonecode=country[0].phonecode;
        }
        return response.status(200).send({
            status: true,
            data: {
                userDetail: userDetail,
                user: user,
                userInterest: userInterest.toJSON(),
                userCertification: userCertification.toJSON(),
                userEducation: userEducation.toJSON(),
                userAchievement: userAchievement.toJSON(),
                userProject: userProject.toJSON(),
                positionOfResponsibility: positionOfResponsibility.toJSON(),
                userExperiences: userExperiences.toJSON(),
                userStartup: userStartup.toJSON(),
                userStartupCategory: userStartupCategory.toJSON(),
            }
        })
    }


    // async getMentorList({request,response,auth}){
    //   if(auth.user.user_type != "MENTEE"){
    //     return response.status(200).send({
    //       status:false,
    //       message:"Sorry not a mentee"
    //     })
    //   }

    //   var mentorList = await User.query().where({user_type:"MENTOR", deleted_at: null, deleted_by: null}).with('detail').fetch();
    //   mentorList = mentorList.toJSON();

    //   var calendar = await Calendar.all();
    //   calendar = calendar.toJSON();

    //   let ids = _.map(calendar,'mentor_id');
    //   let _ids = _.sortedUniq(ids)
    //   let lookedUp = [];

    //   let list = [];
    //   for (let index = 0; index < mentorList.length; index++) {
    //     const element = mentorList[index];
    //     for (let j = 0; j < _ids.length; j++) {
    //       const _element= _ids[j];
    //       if(element.id == _element && lookedUp.indexOf(_element) < 0){
    //           lookedUp.push(_element)
    //           list.push(element);
    //       }
    //     }
    //   }

    //   return response.status(200).send({
    //     status:true,
    //     message:'Mentor list',
    //     data:list,
    //   })
    // }

    async getMentorList({request, response, auth}) {
        if ((auth.user.user_type != "MENTEE") && (auth.user.user_type != "ADMIN")) {
            return response.status(200).send({
                status: false,
                message: "Sorry not a mentee"
            })
        }
        //var LocalmentorList = await User.query().where({user_type:"MENTOR", deleted_at: null, deleted_by: null, country_id:auth.user.country_id}).with('detail').fetch();
        // mentorList = mentorList.toJSON();


        var mentorList = await Database.raw(`	
      SELECT t1.id, t1.username, t1.email, t1.first_name, t1.middle_name, t1.last_name,
          t1.gender, t1.user_type, t1.user_category, t1.user_interest, t1.mobile_no, t1.mobile_verified,
          t1.designation, CASE t1.profile_image WHEN 'null' THEN NULL ELSE  t1.profile_image END AS'profile_image',
          t1.date_of_birth, t1.common_address_line_1,t1.common_address_line_2, t1.common_city, 
          t1.common_state, t1.common_pin, t1.common_country, t1.user_status, t1.provider_id, t1.provider_token, t1.referal_code, t1.referred_by,
          t1.about, t1.user_categories, t1.organisation, t1.country_id, t1.org_id,
          t3.maritial_status, t3.pincode,t3.university_name, t3.stream, t3.highest_education, t3.passing_year,
      t3.2nd_highest_education, t3.2nd_institution, t3.2nd_country, t3.no_of_year_work_exp,t3.company_name,t3.area_of_experties,
      t3.no_of_year_mentorship_exp,t3.mentor_area_of_experties,t3.mentor_cv,t3.average_availability,t3.industry, t3.current_position, t4.mentor_cost, t4.mentor_usd_cost,t1.sequence
      FROM mentorkart.users  AS t1 
      Left JOIN mentorkart.mentors AS t4 ON t1.id=t4.user_id 
      Left JOIN mentorkart.user_profiles AS t3 ON t1.id=t3.user_id 
      WHERE t1.user_type='MENTOR'AND t1.deleted_at IS null AND t1.deleted_by IS null AND t1.country_id=` + auth.user.country_id + ` AND t1.org_id=` + auth.user.org_id + `
      UNION
      SELECT t1.id, t1.username, t1.email, t1.first_name, t1.middle_name, t1.last_name,
          t1.gender, t1.user_type, t1.user_category, t1.user_interest, t1.mobile_no, t1.mobile_verified,
          t1.designation, CASE t1.profile_image WHEN 'null' THEN NULL ELSE  t1.profile_image END AS'profile_image',
          t1.date_of_birth, t1.common_address_line_1,t1.common_address_line_2, t1.common_city, 
          t1.common_state, t1.common_pin, t1.common_country, t1.user_status, t1.provider_id, t1.provider_token, t1.referal_code, t1.referred_by,
          t1.about, t1.user_categories, t1.organisation, t1.country_id, t1.org_id,
          t3.maritial_status, t3.pincode,t3.university_name, t3.stream,t3.highest_education, t3.passing_year,
          t3.2nd_highest_education, t3.2nd_institution, t3.2nd_country, t3.no_of_year_work_exp,t3.company_name,t3.area_of_experties,
          t3.no_of_year_mentorship_exp,t3.mentor_area_of_experties,t3.mentor_cv,t3.average_availability,t3.industry, t3.current_position, t5.mentor_cost, t5.mentor_usd_cost,t1.sequence
      FROM mentorkart.mentor_country_orgs AS t2
      LEFT JOIN mentorkart.users AS t1 ON t2.mentor_id=t1.id 
      LEFT JOIN mentorkart.user_profiles AS t3 ON t1.id=t3.user_id
      Left JOIN mentorkart.mentors AS t5 ON t1.id=t5.user_id
      WHERE t2.country_id=` + auth.user.country_id + ` AND t2.org_id=` + auth.user.org_id + ` OR t2.country_id=240  order by sequence asc ;`);
        return response.status(200).send({
            status: true,
            message: 'Mentor list',
            data: mentorList[0],
        })
    }


    async register({request, response, auth}) {

        let rules = {
            username: 'required',
            mobile_no: 'required|number|min:7|max:15|unique:users',
            email: 'required|email|unique:users',
            password: 'required|min:8',
            password_confirmation: 'required|same:password',
            user_type: 'required|in:MENTOR,MENTEE',
            first_name: 'required',
            last_name: 'required',
            referal_code: 'string',
            country_code: 'required',
            country_name: 'required'
        }

        const validation = await this.validate(request, response, rules);
        if (validation.fails()) {
            return response.status(422).send({
                status: false,
                message: validation.messages()[0].message,
                hint: validation.messages()
            })
        }

        if (!request.input('password').match(/^(?=.*\d)(?=.*[A-Z]).{8,}$/)) {
            return response.status(422).send({
                status: false,
                message: 'Password must contain atleast one uppercase & one numberic',
                hint: 'Regex ^(?=.*\d)(?=.*[A-Z]).{8,}$'
            });
        }

        let inputs = request.only(['username',
            'mobile_no',
            'email',
            'password',
            'user_type',
            'name',
            'first_name',
            'last_name',
            'referal_code',
            'country_code',
            'country_name'
        ]);

        inputs['username'] = inputs['email'];


        const country = await Database.from('country').where({'phonecode': inputs.country_code}).where({'name': inputs.country_name});

        const org = await OrgMaster.query().where({country_id: country[0].id, org_name: 'MENTORKART'}).fetch();
        console.log(country[0].name, country[0].id, org.toJSON());
        const org_id = org.toJSON()

        inputs.common_country = country[0].name;
        inputs.country_id = country[0].id;
        inputs.org_id = org_id[0].id;
        if (request.input('user_category')) {
            inputs.user_category = request.input('user_category');
        }

        const {mobile_no, country_code} = request.all();
        if (country_code == '91') {
            let otp = Math.floor(100000 + Math.random() * 90000).toString()
            var sms = await Sms.send(mobile_no, otp)
            inputs.last_otp = otp
        } else {
            var data = {
                number: `+` + country_code + mobile_no,
                channel: "sms"
            }
            var twiliores = await twilioOTP.sendOTP(data)
            var sms = twiliores.status;
        }

        delete inputs.name;
        delete inputs.country_code;
        delete inputs.country_name;

        let currentUser = await User.findOrCreate(inputs);

        if (country_code == '91') {
            delete currentUser.last_otp;
        }

        let tokens = await auth.withRefreshToken().generate(currentUser)
        if (request.input('lead_id')) {
            const leadModel = use('App/Models/Lead');
            await leadModel.query().where({id: request.input('lead_id')}).update({
                first_name: inputs.first_name,
                last_name: inputs.last_name,
                email: inputs.email,
                mobile_number: inputs.mobile_no,
                user_category: inputs.user_type
            });
        }

        let user = {...currentUser.toJSON()};
        //   const msg = {
        //     to: inputs.email,
        //     from: 'sales@mentorkart.com',
        //     subject: 'User Registration Successful',
        //     text: 'Registration Successful',
        //     html: 'Registration Successful',
        //   };
        //  var y = await sgMail.send(msg);


        return response.status(201).json({
            status: true,
            message: "User Registration Successful",
            data: {
                user,
                credentials: {...tokens},
                userDetail: null,
                smsStatus: sms
            }
        });
    }

    async otpChallenge({request, response, auth}) {
        let {email, mobile_no, country_code} = request.all();
        let key = null;
        let rules = {}
        if (email) {
            key = 'email';
        } else {
            key = 'mobile_no';
            rules = {
                country_code: 'required'
            }
        }
        rules[key] = (key == 'email') ? `required|email` : `required|number|min:7|max:15`;
        const validation = await this.validate(request, response, rules);
        if (validation.fails()) {
            return response.status(422).send({
                status: false,
                message: validation.messages()[0].message,
                hint: validation.messages()
            })
        }
        try {
            let sms;
            let findInAuth;
            let SMSStatus;
            const date = moment().add(10, 'minutes').format('YYYY-MM-DD HH:mm:ss');
            let otp = Math.floor(100000 + Math.random() * 90000).toString();
            if (mobile_no) {
                findInAuth = await UserAuthentication.findBy({mobile_no: mobile_no});
                if (country_code === '91') {
                    sms = await Sms.send(mobile_no, otp)
                } else if (country_code) {
                    let data = {
                        number: `+` + country_code + mobile_no,
                        channel: "sms"
                    }
                    let twiliores = await twilioOTP.sendOTP(data)
                    sms = twiliores.status;
                }
            } else if (email) {
                findInAuth = await UserAuthentication.findBy({email: email});
                let html = '<table style="width: 100%;margin-top: 50px;height: 400px;"><tr style="background-color: #fff"><td align="center"><img style="width: 100px;height: 100px;object-fit: contain;"  src="https://emailtemplateassests.s3.ap-south-1.amazonaws.com/mentorlogo+(2)+(1)-2.png" alt = "logo" />'
                html += '</td></tr><tr class="max"><td><p style="margin-left:10px">Hi, MENTEE </p><p style=" margin-left:10px; margin-top: 30px">Welcome to MentorKart!</p>'
                html += '<p style="margin-left:10px; margin-top: 30px;">You Verification OTP: ' + otp + '</p><p style="margin-left:10px; margin-top: 30px;">This OTP is valid for 10 minutes.</p>'
                html += '<p style="margin-left:10px; margin-top: 30px;">Thanks & Regards</p><p style="margin-left:10px">Team MentorKart</p></td></tr></table>';
                const msg = {
                    to: email,
                    from: Env.get('MAIL_USER'),
                    subject: 'MENTEE, Verification OTP',
                    html: html,
                };
                sms = await sgMail.send(msg);
            }
            if (sms.success || sms === 'pending') {
                SMSStatus = true
            } else {
                SMSStatus = false
            }
            if (findInAuth) {
                await UserAuthentication.query().update({'otp': otp, 'otp_expiry': date}).where('id', findInAuth.id)
            } else {
                let inputs = request.only([
                    'mobile_no',
                    'email'
                ]);
                inputs['otp'] = otp;
                inputs['otp_expiry'] = moment().add(10, 'minutes').format('YYYY-MM-DD HH:mm:ss');
                await UserAuthentication.create(inputs);
            }
            return response.status(201).send({
                status: true,
                message: "OTP Send Successfully",
                SMSStatus: SMSStatus,
                data: {
                    smsStatus: sms
                }
            });
        } catch (e) {
            return response.status(400).send({
                status: false,
                message: "Unable to send Otp. Please try again with valid number"
            })
        }
    }

    async login({request, response, auth}) {


        let {email, phone_number, password} = request.all();
        var key = null;

        if (email) {
            key = 'email';
        } else {
            key = 'phone_number';
        }

        let rules = {
            password: 'required'
        }

        rules[key] = (key == 'email') ? `required|email` : `required|number|min:7|max:15`;

        let validation = await this.validate(request, response, rules);

        if (validation.fails()) {
            return response.status(400).send({
                status: false,
                message: 'Invalid Credentials',
                error: validation.messages()
            });
        }

        let userDetail = null;
        let credentials = null;
        let user = null;

        if (key == 'phone_number') {
            const Hash = use('Hash')
            user = await User.findBy('mobile_no', phone_number);

            if (!user) {
                return response.status(400).send({
                    status: false,
                    message: 'Invalid Credentials'
                })
            }
            email = user.email;
        }

        try {
            credentials = await auth.withRefreshToken().attempt(email, password);
            user = (user) ? user : await User.findBy('email', email);

            if (user.deleted_by != null) {
                return response.status(400).send({
                    status: false,
                    message: "Your account has been suspended, please contact admin"
                })
            }
            userDetail = await user.detail().fetch()
            Event.emit('user::login', user, request.header('X-Forwarded-For'));
        } catch (error) {
            return response.status(400).send({
                status: false,
                message: 'Invalid Credentials',
                error: error
            })
        }

        return {credentials, data: {user, userDetail}};
    }
    async adminLogin({request, response, auth}) {
        let {email} = request.all();
        let validation = await this.validate(request, response, { email: 'required|email' });
        if (validation.fails()) {
            return response.status(400).send({
                status: false,
                message: 'Invalid Credentials',
                error: validation.messages()
            });
        }
        try {
            // credentials = await auth.withRefreshToken().attempt(email, password);
            let user = await User.findBy('email', email);
            if (user.deleted_by != null) {
                return response.status(400).send({
                    status: false,
                    message: "Your account has been suspended, please contact admin"
                })
            }
            let credentials = await auth.withRefreshToken().generate(user);
            Event.emit('user::login', user, request.header('X-Forwarded-For'));
            return response.status(200).send({
                status: true,
                message: 'Login Successfully.',
                credentials: credentials
            })
        } catch (error) {
            return response.status(400).send({
                status: false,
                message: 'Invalid Credentials',
                error: error
            })
        }
    }
    async adminUserCreate({request, response}) {
        let {email} = request.all();
        let validation = await this.validate(request, response, { email: 'required|email' });
        if (validation.fails()) {
            return response.status(400).send({
                status: false,
                message: 'Invalid Credentials',
                error: validation.messages()
            });
        }
        try {
            let user = await User.findBy('email', email);
            if(user){
                if (user.deleted_by != null) {
                    return response.status(400).send({
                        status: false,
                        message: "Your account has been suspended, please contact admin"
                    })
                }
                await User.query().update({'user_type': 'ADMIN'}).where('id', user.id)
                return response.status(200).send({
                    status: true,
                    message: 'User Created Successfully.'
                })
            }else {
                return response.status(400).send({
                    status: false,
                    message: "User email does not exist."
                })
            }
        } catch (error) {
            return response.status(400).send({
                status: false,
                message: 'Something went wrong!'
            })
        }
    }


    async generateToken({request, response, auth}) {
        const refreshToken = request.input('refresh_token')
        if (!refreshToken) {
            return {
                status: false,
                message: 'No refresh token available'
            }
        }
        return await auth.generateForRefreshToken(refreshToken, true)
    }


    async changePassword({request, response, auth}) {

        let rules = {
            old_password: 'required',
            password: 'required',
            password_confirmation: 'required|same:password'
        }

        const validation = await this.validate(request, response, rules);
        if (validation.fails()) {
            return response.status(422).send({
                status: false,
                message: validation.messages()[0].message,
                hint: validation.messages()
            })
        }

        if (!request.input('password').match(/^(?=.*\d)(?=.*[A-Z]).{8,}$/)) {
            return response.status(422).send({
                status: false,
                message: 'Password must contain atleast one uppercase & one numberic',
                hint: 'Regex ^(?=.*\d)(?=.*[A-Z]).{8,}$'
            });
        }

        try {
            let email = auth.user.email;
            let old_password = request.input('old_password');
            await auth.attempt(email, old_password)

            auth.user.password = request.input('password');
            await auth.user.save();

            return response.status(200).send({
                status: false,
                message: 'Password Updated Successfully',
                hint: 'SUCCESS'
            })


        } catch (error) {
            return response.status(400).send({
                status: false,
                message: 'Invalid Credentials',
                hint: 'Logout'
            })
        }

    }


    async updateProfile({request, response, auth}) {

        let rules = {
            user_category: 'in:STUDENT,ENTREPRENEUR,PROFESSIONAL',
            designation: 'string',
            gender: 'in:MALE,FEMALE,OTHERS',
            date_of_birth: 'string',
            about: 'string',
            user_type: 'in:MENTOR,MENTEE',
            common_address_line_1: 'string',
            common_address_line_2: 'string',
            common_city: 'string',
            common_state: 'string',
            common_pin: 'string',
            common_country: 'string',
            user_status: 'string',
            created_by: 'string',
            deleted_by: 'string',
            modified_by: 'string',
            highest_education: 'string',
            passing_year: 'string',
            institute: 'string',
            country: 'string',
            '2nd_highest_education': 'string',
            '2nd_institution': 'string',
            '2nd_country': 'string',
            no_of_year_work_exp: 'number',
            company_name: 'string',
            area_of_experties: 'string',
            no_of_year_mentorship_exp: 'number',
            mentor_area_of_experties: 'string',
            mentor_cv: 'string',
            maritial_status: 'in:MARRIED,UNMARRIED',
            pincode: 'integer|max:6',
            university_name: 'string',
            stream: 'in:ART,SCIENCE,COMMERCE',
            average_availability: 'string',
            industry: 'string',
            current_position: 'string',
        }

        const validation = await this.validate(request, response, rules);
        if (validation.fails()) {
            return response.status(422).send({
                status: false,
                message: validation.messages()[0].message,
                hint: validation.messages()
            })
        }
        var imagePath = null;
        let S3Url = null;

        if (request.file('profile_image')) {
            const AssetData = request.file("profile_image", {
                types: ["image"]
            });

            var randomstring = Math.random()
                .toString(36)
                .slice(-8);
            var hash = md5(randomstring);

            var documentName = hash + "." + (AssetData.extname).toLowerCase();

            await AssetData.move(Helpers.appRoot() + '/storage/profileimage', {
                name: documentName,
                overwrite: false
            });

            imagePath = '/profileimage/' + documentName;

            var _path = Env.get('APP_URL') + '/public/profileimage/' + documentName;

            if (!AssetData.moved()) {
                return AssetData.error();
            }

            const FileHelper = use('App/utils/FileHelper')

            S3Url = await FileHelper.uploadToPublicS3(Helpers.appRoot() + '/storage/profileimage/' + documentName);
            imagePath = S3Url;
        }


        const exists = await UserProfile.findBy({user_id: auth.user.id});
        const userexists = await User.findBy({id: auth.user.id});

        const data = request.only([
            'user_category', 'gender', 'about', 'mobile_verified', 'profie_image', 'designation', 'date_of_birth', 'common_country', 'common_address_line_1', 'common_address_line_2', 'common_city', 'common_state', 'common_pin', 'linked_in',
        ]);
        console.log(data);

        if (imagePath) {
            data.profile_image = imagePath;
        }

        if (!data.user_category) {
            delete data.user_category
        }

        const inputs = request.only([
            'maritial_status',
            'pincode',
            'university_name',
            'highest_education',
            'passing_year',
            'institute',
            'country',
            '2nd_highest_education',
            '2nd_institution',
            '2nd_country',
            'no_of_year_work_exp',
            'company_name',
            'area_of_experties',
            'no_of_year_mentorship_exp',
            'mentor_area_of_experties',
            'mentor_cv',
            'stream',
            'average_availability',
            'industry',
            'current_position'
        ])

        inputs.user_id = auth.user.id;

        let userDetail = null;
        let userprofile = null;

        if (!userexists) {
            userDetail = await User.create(data);
        } else {
            userDetail = await User.query().where({
                id: auth.user.id
            }).update(data);
            userDetail = data;
        }

        if (request.input('passing_year')) {
            let _py = request.input('passing_year');
            _py = moment(_py, 'YYYY');
            let thisYear = moment();
            let diff = _py.diff(thisYear, 'years');

            if (diff > 10) {
                return response.status(400).send({
                    status: false,
                    message: 'Passing out year should be with in 10 years'
                })
            }
        }

        if (!exists) {
            userprofile = await UserProfile.create(inputs);
        } else {
            userprofile = await UserProfile.query().where({
                user_id: auth.user.id
            }).update(inputs);
            userprofile = inputs;
        }
        if (imagePath) {
            userDetail.profile_image = Env.get('AWS_ADMIN_S3_URL') + '/' + imagePath;
            ;
        }

        return response.status(200).send({
            status: true,
            message: "User detail updated successfully",
            data: {
                userDetail,
                userprofile
            }
        })

    }


    async deleteUser({request, response, auth}) {
        const user = await User.find(auth.user.id)
        await user.delete()

        return {
            state: true,
            message: "User deleted successfully"
        }

    }


    async resetPassword({request, response}) {
        var randomstring = Math.random().toString(36).slice(-8);
        let rules = {
            email: 'required|email'
        }

        const validation = await this.validate(request, response, rules);
        if (validation.fails()) {
            return response.status(422).send({
                status: false,
                message: validation.messages()[0].message,
                hint: validation.messages()
            })
        }
        const safePassword = await Hash.make(randomstring)
        var inputs = request.only([
            'email'
        ])
        inputs.password = safePassword;
        // await Mail.send((message) => {
        //   message
        //     .to(inputs.email)
        //     .from('mentorkart')
        //     .subject('Your new password is : '  + safePassword)
        // })
        return 'Mail sended to your email address'
    }


    async createUserInterest({request, response, auth}) {

        var inputs = request.only([
            'user_interests'
        ])

        let masterInterest = await InterestMaster.query().whereIn('id', inputs.user_interests).fetch();
        masterInterest = masterInterest.toJSON();
        let u_id=(request.input('user_id')) ? request.input('user_id') : auth.user.id;
        await UserInterest.query().where('user_id', u_id).delete();

        const insertArray = masterInterest.map((m) => {
            let value = {};
            value.user_id = u_id;
            value.user_interests = m.interest_name;
            value.master_interest_id = m.id;
            return value;
        })

        let result = await UserInterest.createMany(insertArray);

        return response.status(201).json({
            status: true,
            message: "User interest creation Successful",
            data: result
        });
    }


    async getAllUserInterest({request, response}) {
        var allUser = await User.query().where({user_type: "MENTOR"}).fetch();
        var user = allUser.toJSON();
        var interest = {};
        for (var i = 0; i < user.length; i++) {
            var value = await UserInterest.query().where({user_id: user[i].id}).fetch();
            interest[i] = value.toJSON();
        }
        return response.send(interest);
    }

    async updateCategory({request, response, auth}) {

        let rules = {
            user_category: 'required|in:STUDENT,ENTREPRENEUR,PROFESSIONAL',
        }

        const validation = await this.validate(request, response, rules);
        if (validation.fails()) {
            return response.status(422).send({
                status: false,
                message: validation.messages()[0].message,
                hint: validation.messages()
            })
        }

        const UserProfile = use('App/Models/UserProfile');

        let _userProfile = await UserProfile.findBy({user_id: auth.user.id});
        let _user = await User.findBy({id: auth.user.id});

        if (!_user) {
            return response.status(400).send({
                status: false,
                message: "User doesn't exists"
            })
        } else {
            _user.user_category = request.input('user_category');
            await _user.save();
        }

        return response.status(200).send({
            status: true,
            message: "User Category updated successfully",
            data: {
                userDetail: _user,
                userprofile: _userProfile
            }
        })
    }


    async moodUpdate({request, response, auth}) {

        await Redis.set('USER_MOOD_' + auth.user.id, request.input('mood'), 'EX', 12 * 3600);
        return response.status(200).send({
            status: true,
            message: 'Mood Successfully Updated'
        })

    }

    // Bulk upload

    async userBulkUpload({request, response, auth}) {
        try {
            const excelData = request.all();
            const data = JSON.parse(excelData.data);
            console.log("exceldata======", data)
            const leadModel = use('App/Models/Lead');
            const SubscriptionPlan = use('App/Models/SubscriptionPlan')
            let subscription = await SubscriptionPlan.find(data[0].subscription_id);
            let valid_till = moment().add(subscription.frequency, subscription.interval.toLowerCase()).format('YYYY-MM-DD')
            const insertArray = data.forEach(async m => {
                let user_pasword = password.randomPassword({
                    length: 10,
                    characters: password.lower + password.upper + password.digits
                })
                var fetchUser = await User.findBy({email: m.email_Id});
                // console.log("fetchUser-------",fetchUser)
                // if(!fetchUser){
                //   let sendEmail = await Mail.send('mails.bulkmail',{name: m.first_name,loginID:m.email_Id,password:user_pasword}, (message) => {
                //     message.from(Env.get('MAIL_USER'), 'Mentorkart')
                //     message.to(m.email_Id)
                //     message.subject('MentorKart login credentials')
                //     // message.bcc(Env.get('MAIL_USER'))
                //   })
                // }

                let value = {};
                value.mobile_no = m.contact_number;
                value.email = m.email_Id;
                value.username = m.email_Id;
                value.user_type = m.user_type;
                value.user_category = m.user_category;
                value.password = user_pasword;
                value.first_name = m.first_name;
                value.last_name = m.last_name;
                value.country_id = m.country_id;
                value.org_id = m.org_id;
                value.common_country = m.country_name;
                value.mobile_verified = m.isMobileVerified;
                value.subscription_plan_id = m.subscription_id;
                var currentUser = await User.findOrCreate({email: value.email}, value).then(async data => {
                    let fetchUserSubscription = await UserSubscription.findBy({user_id: data.id});
                    console.log("fetchUserSubscription-------", fetchUserSubscription)
                    if (!fetchUserSubscription) {
                        let subEmail = await Mail.send('mails.subscription', {name: m.first_name}, (message) => {
                            message.from(Env.get('MAIL_USER'), 'Mentorkart')
                            message.to(m.email_Id)
                            message.subject('Subscription Purchased')
                            message.bcc(Env.get('MAIL_USER'))
                        })
                    }
                    // Handle Lead
                    let lead = {};
                    lead.mobile_number = m.contact_number;
                    lead.email = m.email_Id;
                    lead.user_category = m.user_category;
                    lead.first_name = m.first_name;
                    lead.last_name = m.last_name;
                    lead.utm_source = m.lead_name;
                    let feedLead = await leadModel.findOrCreate({email: m.email_Id}, lead);

                    // Handle subscription
                    let userSubscription = {};
                    userSubscription.user_id = data.id;
                    userSubscription.subscription_plan_id = m.subscription_id;
                    userSubscription.order_id = 0;
                    userSubscription.transaction_id = 0;
                    userSubscription.valid_till = valid_till;
                    UserSubscription.findOrCreate({user_id: data.id}, userSubscription);

                    //Handle UserProfile
                    let userProfileData = {};
                    userProfileData.user_id = data.id;
                    userProfileData.university_name = m.university_name;
                    UserProfile.findOrCreate(userProfileData);


                }).catch(err => {
                    return response.status(500).send({
                        status: false,
                        message: 'Something Went Wrong while creating user!'
                    })
                })

      });
      return response.status(200).send({
        status:true,
        message:"Successfully Uploaded Bulk File!",
      })
    } catch (error) {
      console.log("Error in Bulk Users-",error)
      return response.status(400).send({
        status: false,
        message: 'Something Went Wrong!'
      })
    }
  }
  async getMentorsList({request,response,auth}){
    if((auth.user.user_type != "MENTEE") && (auth.user.user_type != "ADMIN")){
      return response.status(200).send({
        status:false,
        message:"Sorry not a mentee"
      })
    }
    let mentorList=await User.query()
        .where({country_id:auth.user.country_id,user_type:'MENTOR',org_id:auth.user.org_id})
        .whereNull('deleted_by','deleted_at')
        .leftJoin('mentors', 'users.id', 'mentors.user_id')
        .leftJoin('user_profiles', 'users.id', 'user_profiles.user_id')
        .select('users.*')
        .select('mentors.mentor_cost','mentors.mentor_usd_cost')
        .select('user_profiles.maritial_status','user_profiles.pincode','user_profiles.university_name','user_profiles.stream','user_profiles.highest_education','user_profiles.passing_year','user_profiles.2nd_highest_education','user_profiles.2nd_institution','user_profiles.2nd_country','user_profiles.no_of_year_work_exp','user_profiles.company_name','user_profiles.area_of_experties','user_profiles.no_of_year_mentorship_exp','user_profiles.mentor_area_of_experties','user_profiles.mentor_cv','user_profiles.average_availability','user_profiles.industry','user_profiles.current_position')
        .with('user_experiences',(data)=>{
          data.orderBy('start_date','desc')
        })
        .union((query) => {
          query.from('mentor_country_orgs')
              .leftJoin('users', 'mentor_country_orgs.mentor_id', 'users.id')
              .leftJoin('mentors', 'users.id', 'mentors.user_id')
              .leftJoin('user_profiles', 'users.id', 'user_profiles.user_id')
              .with('user_experiences',(data)=>{
                data.orderBy('start_date','desc')
              })
              .select('users.*')
              .select('mentors.mentor_cost','mentors.mentor_usd_cost')
              .select('user_profiles.maritial_status','user_profiles.pincode','user_profiles.university_name','user_profiles.stream','user_profiles.highest_education','user_profiles.passing_year','user_profiles.2nd_highest_education','user_profiles.2nd_institution','user_profiles.2nd_country','user_profiles.no_of_year_work_exp','user_profiles.company_name','user_profiles.area_of_experties','user_profiles.no_of_year_mentorship_exp','user_profiles.mentor_area_of_experties','user_profiles.mentor_cv','user_profiles.average_availability','user_profiles.industry','user_profiles.current_position')
              .where({'mentor_country_orgs.country_id':auth.user.country_id,'mentor_country_orgs.org_id':auth.user.org_id})
              .orWhere({'mentor_country_orgs.country_id': 240})
        })
        .orderBy('sequence', 'asc')
        .fetch();
    return response.status(200).send({
      status:true,
      message:'Mentor list',
      data:mentorList,
    })
  }

  async getUTMSource({request,response,auth}){
    const leadModel = use('App/Models/Lead');
    let rules = {
      email: 'required',
    }
    const validation = await this.validate(request, response, rules);
    if (validation.fails()) {
      return response.status(422).send({
        status: false,
        message: validation.messages()[0].message,
        hint: validation.messages()
      })
    }
    let email_arr=JSON.parse(request.input('email'));
    let getLead = await leadModel.query().select('email','first_name','last_name','mobile_number','utm_source').whereIn('email', email_arr).fetch();
    return response.status(200).send({
      status:true,
      message:'Lead list',
      data:getLead
    })
  }
  async signupDetails({request,response,auth}){
    let rules = {
      email: 'email|unique:users',
      user_category: 'in:STUDENT,ENTREPRENEUR,PROFESSIONAL',
      mobile_no: 'number|min:7|max:15|unique:users',
    }
    const validation = await this.validate(request, response, rules);
    if (validation.fails()) {
      return response.status(422).send({
        status: false,
        message: validation.messages()[0].message,
        hint: validation.messages()
      })
    }
    var inputs = request.all();
    await User.query().where('id',auth.user.id).update(inputs);
    const exists = await UserProfile.findBy({user_id: auth.user.id});
    const user = await User.findBy({id:auth.user.id});
    if(!exists){
      await UserProfile.create({'user_id':auth.user.id});
    }
    if(user.deleted_by != null){
      return response.status(400).send({
        status:false,
        message:"Your account has been suspended, please contact admin"
      })
    }
    let userDetail = await user.detail().select('id','user_id','area_of_experties','industry').fetch();
    Event.emit('new::user', {first_name: user.first_name, email: user.email,user_type:user.user_type});
    return response.status(200).send({
      status: true,
      message: "User detail updated Successfully",
      data: { user: {id:user.id,
          email:user.email,
          first_name:user.first_name,
          last_name:user.last_name,
          mobile_no:user.mobile_no,
          user_category:user.user_category,
          user_type:user.user_type,
          mobile_verified:user.mobile_verified,
          is_email_verified:user.is_email_verified,
          country_id:user.country_id},
        userDetail:userDetail }
    });
  }
  async mentorSignupDetails({request,response,auth}){
    let rules = {
      industry: 'string'
    }
    const validation = await this.validate(request, response, rules);
    if (validation.fails()) {
      return response.status(422).send({
        status: false,
        message: validation.messages()[0].message,
        hint: validation.messages()
      })
    }
    let inputs = request.all();
    const exists = await UserProfile.findBy({user_id: auth.user.id});
    const user = await User.findBy({id:auth.user.id});
    if (inputs.user_interest){
      let masterInterest = await InterestMaster.query().whereIn('id',inputs.user_interest).fetch();
      masterInterest = masterInterest.toJSON();
      let userInterest=await UserInterest.query().where('user_id', auth.user.id).select('master_interest_id').fetch();
      userInterest = userInterest.toJSON();
      userInterest=(userInterest) ? userInterest.map((item)=>{ return Number(item.master_interest_id) }):null;
      const insertArray = [];
      masterInterest.filter((m) => {
        if (!userInterest.includes(m.id)){
          insertArray.push({user_id : auth.user.id,
            user_interests: m.interest_name,
            master_interest_id : m.id});
        }
      })
      if (insertArray) await UserInterest.createMany(insertArray);
      delete inputs.user_interest
    }
    if (inputs.area_of_experties){
      let _t = inputs.area_of_experties;
      if(!Array.isArray(_t)){
        _t = [_t]
      }
      inputs.area_of_experties = _t.join();
    }
    if(!exists){
      inputs.user_id=auth.user.id;
      await UserProfile.create(inputs);
    }else{
      await UserProfile.query().where('user_id',auth.user.id).update(inputs);
    }
    if(user.deleted_by != null){
      return response.status(400).send({
        status:false,
        message:"Your account has been suspended, please contact admin"
      })
    }
    let userDetail = await user.detail().select('id','user_id','area_of_experties','industry').fetch();
    return response.status(200).send({
      status: true,
      message: "User detail updated Successfully",
      data: { user: {id:user.id,
          email:user.email,
          first_name:user.first_name,
          last_name:user.last_name,
          mobile_no:user.mobile_no,
          user_category:user.user_category,
          user_type:user.user_type,
          mobile_verified:user.mobile_verified,
          is_email_verified:user.is_email_verified,
          country_id:user.country_id},
        userDetail:userDetail }
    });
  }
  async otpMobileChallenge({request,response}) {
    let {  mobile_no,country_code } = request.all();
    let rules = {
      mobile_no: 'required|number|min:7|max:15|unique:users',
      country_code:'required|number'
    }
    const validation = await this.validate(request, response, rules);
    if (validation.fails()) {
      return response.status(422).send({
        status: false,
        message: validation.messages()[0].message,
        hint: validation.messages()
      })
    }
    try{
      let sms;let findInAuth;
      const date=moment().add(10, 'minutes').format('YYYY-MM-DD HH:mm:ss');
      let otp = Math.floor(100000 + Math.random() * 90000).toString();
      findInAuth=await UserAuthentication.findBy({mobile_no:mobile_no});
      if(country_code === '91') {
        sms = await Sms.send(mobile_no, otp)
      }else if(country_code){
        let data={
          number: `+`+country_code+mobile_no,
          channel: "sms"
        }
        let twiliores = await twilioOTP.sendOTP(data)
        sms = twiliores.status;
      }
      let SMSStatus = (sms.success || sms === 'pending') ? true : false;
      if(findInAuth){
        await UserAuthentication.query().update({'otp':otp,'otp_expiry':date}).where('id',findInAuth.id)
      }else{
        await UserAuthentication.create({
          mobile_no:mobile_no, otp:otp, otp_expiry:moment().add(10, 'minutes').format('YYYY-MM-DD HH:mm:ss') });
      }
      return response.status(201).send({
        status: true,
        message: "OTP Send Successfully",
        SMSStatus:SMSStatus,
        data: {
          smsStatus: sms
        }
      });
    }catch (e) {
      return response.status(400).send({
        status: false,
        message: "Unable to verify Otp"
      })
    }
  }

  async getMentorsList({request, response, auth}) {
        if ((auth.user.user_type != "MENTEE") && (auth.user.user_type != "ADMIN")) {
            return response.status(200).send({
                status: false,
                message: "Sorry not a mentee"
            })
        }
        let mentorList = await User.query()
            .where({country_id: auth.user.country_id, user_type: 'MENTOR', org_id: auth.user.org_id})
            .whereNull('deleted_by', 'deleted_at')
            .leftJoin('mentors', 'users.id', 'mentors.user_id')
            .leftJoin('user_profiles', 'users.id', 'user_profiles.user_id')
            .select('users.*')
            .select('mentors.mentor_cost', 'mentors.mentor_usd_cost')
            .select('user_profiles.maritial_status', 'user_profiles.pincode', 'user_profiles.university_name', 'user_profiles.stream', 'user_profiles.highest_education', 'user_profiles.passing_year', 'user_profiles.2nd_highest_education', 'user_profiles.2nd_institution', 'user_profiles.2nd_country', 'user_profiles.no_of_year_work_exp', 'user_profiles.company_name', 'user_profiles.area_of_experties', 'user_profiles.no_of_year_mentorship_exp', 'user_profiles.mentor_area_of_experties', 'user_profiles.mentor_cv', 'user_profiles.average_availability', 'user_profiles.industry', 'user_profiles.current_position')
            .with('user_experiences', (data) => {
                data.orderBy('start_date', 'desc')
            })
            .union((query) => {
                query.from('mentor_country_orgs')
                    .leftJoin('users', 'mentor_country_orgs.mentor_id', 'users.id')
                    .leftJoin('mentors', 'users.id', 'mentors.user_id')
                    .leftJoin('user_profiles', 'users.id', 'user_profiles.user_id')
                    .with('user_experiences', (data) => {
                        data.orderBy('start_date', 'desc')
                    })
                    .select('users.*')
                    .select('mentors.mentor_cost', 'mentors.mentor_usd_cost')
                    .select('user_profiles.maritial_status', 'user_profiles.pincode', 'user_profiles.university_name', 'user_profiles.stream', 'user_profiles.highest_education', 'user_profiles.passing_year', 'user_profiles.2nd_highest_education', 'user_profiles.2nd_institution', 'user_profiles.2nd_country', 'user_profiles.no_of_year_work_exp', 'user_profiles.company_name', 'user_profiles.area_of_experties', 'user_profiles.no_of_year_mentorship_exp', 'user_profiles.mentor_area_of_experties', 'user_profiles.mentor_cv', 'user_profiles.average_availability', 'user_profiles.industry', 'user_profiles.current_position')
                    .where({
                        'mentor_country_orgs.country_id': auth.user.country_id,
                        'mentor_country_orgs.org_id': auth.user.org_id
                    })
                    .orWhere({'mentor_country_orgs.country_id': 240})
            })
            .orderBy('sequence', 'asc')
            .fetch();
        return response.status(200).send({
            status: true,
            message: 'Mentor list',
            data: mentorList,
        })
    }

    async signupDetails({request, response, auth}) {
        let rules = {
            email: 'email',
            user_category: 'in:STUDENT,ENTREPRENEUR,PROFESSIONAL',
            mobile_no: 'number|min:7|max:15',
        }
        const validation = await this.validate(request, response, rules);
        if (validation.fails()) {
            return response.status(422).send({
                status: false,
                message: validation.messages()[0].message,
                hint: validation.messages()
            })
        }
        let inputs = request.all();
        inputs.username=(inputs.email) ? inputs.email : null ;
        let checkNewUser = await User.query().where({id:auth.user.id}).whereNull('email','first_name').fetch();
        await User.query().where('id', auth.user.id).update(inputs);
        const exists = await UserProfile.findBy({user_id: auth.user.id});
        const user = await User.findBy({id: auth.user.id});
        if (!exists) {
            await UserProfile.create({'user_id': auth.user.id});
        }
        if (user.deleted_by != null) {
            return response.status(400).send({
                status: false,
                message: "Your account has been suspended, please contact admin"
            })
        }
        let userDetail = await user.detail().select('id', 'user_id', 'area_of_experties', 'industry').fetch();
        if (checkNewUser.rows.length){
            Event.emit('new::user', {first_name: user.first_name, email: user.email,user_type:user.user_type});
            //send welcome mail to new user
        }
        return response.status(200).send({
            status: true,
            message: "User detail updated Successfully",
            data: {
                user: {
                    id: user.id,
                    email: user.email,
                    first_name: user.first_name,
                    last_name: user.last_name,
                    mobile_no: user.mobile_no,
                    user_category: user.user_category,
                    user_type: user.user_type,
                    mobile_verified: user.mobile_verified,
                    is_email_verified: user.is_email_verified,
                    country_id: user.country_id
                },
                userDetail: userDetail
            }
        });
    }

    async mentorSignupDetails({request, response, auth}) {
        let rules = {
            industry: 'string'
        }
        const validation = await this.validate(request, response, rules);
        if (validation.fails()) {
            return response.status(422).send({
                status: false,
                message: validation.messages()[0].message,
                hint: validation.messages()
            })
        }
        let inputs = request.all();
        const exists = await UserProfile.findBy({user_id: auth.user.id});
        const user = await User.findBy({id: auth.user.id});
        if (inputs.user_interest) {
            let masterInterest = await InterestMaster.query().whereIn('id', inputs.user_interest).fetch();
            masterInterest = masterInterest.toJSON();
            let userInterest = await UserInterest.query().where('user_id', auth.user.id).select('master_interest_id').fetch();
            userInterest = userInterest.toJSON();
            userInterest = (userInterest) ? userInterest.map((item) => {
                return Number(item.master_interest_id)
            }) : null;
            const insertArray = [];
            masterInterest.filter((m) => {
                if (!userInterest.includes(m.id)) {
                    insertArray.push({
                        user_id: auth.user.id,
                        user_interests: m.interest_name,
                        master_interest_id: m.id
                    });
                }
            })
            if (insertArray) await UserInterest.createMany(insertArray);
            delete inputs.user_interest
        }
        if (inputs.area_of_experties) {
            let _t = inputs.area_of_experties;
            if (!Array.isArray(_t)) {
                _t = [_t]
            }
            inputs.area_of_experties = _t.join();
        }
        if (!exists) {
            inputs.user_id = auth.user.id;
            await UserProfile.create(inputs);
        } else {
            await UserProfile.query().where('user_id', auth.user.id).update(inputs);
        }
        if (user.deleted_by != null) {
            return response.status(400).send({
                status: false,
                message: "Your account has been suspended, please contact admin"
            })
        }
        let userDetail = await user.detail().select('id', 'user_id', 'area_of_experties', 'industry').fetch();
        return response.status(200).send({
            status: true,
            message: "User detail updated Successfully",
            data: {
                user: {
                    id: user.id,
                    email: user.email,
                    first_name: user.first_name,
                    last_name: user.last_name,
                    mobile_no: user.mobile_no,
                    user_category: user.user_category,
                    user_type: user.user_type,
                    mobile_verified: user.mobile_verified,
                    is_email_verified: user.is_email_verified,
                    country_id: user.country_id
                },
                userDetail: userDetail
            }
        });
    }

    async otpMobileChallenge({request, response}) {
        let {mobile_no, country_code,email} = request.all();
        let rules = {
            mobile_no: 'required|number|min:7|max:15',
            country_code: 'required|number'
        }
        const validation = await this.validate(request, response, rules);
        if (validation.fails()) {
            return response.status(422).send({
                status: false,
                message: validation.messages()[0].message,
                hint: validation.messages()
            })
        }
        try {
            const userDetail=await User.findBy('mobile_no',mobile_no)
            if (userDetail && userDetail.email !== email){
                return response.status(400).send({
                    status: false,
                    message: "This mobile number is already exist."
                })
            }
            let sms;
            let findInAuth;
            const date = moment().add(10, 'minutes').format('YYYY-MM-DD HH:mm:ss');
            let otp = Math.floor(100000 + Math.random() * 90000).toString();
            findInAuth = await UserAuthentication.findBy({mobile_no: mobile_no});
            if (country_code === '91') {
                sms = await Sms.send(mobile_no, otp)
            } else if (country_code) {
                let data = {
                    number: `+` + country_code + mobile_no,
                    channel: "sms"
                }
                let twiliores = await twilioOTP.sendOTP(data)
                sms = twiliores.status;
            }
            let SMSStatus = (sms.success || sms === 'pending') ? true : false;
            if (findInAuth) {
                await UserAuthentication.query().update({'otp': otp, 'otp_expiry': date}).where('id', findInAuth.id)
            } else {
                await UserAuthentication.create({
                    mobile_no: mobile_no,
                    otp: otp,
                    otp_expiry: moment().add(10, 'minutes').format('YYYY-MM-DD HH:mm:ss')
                });
            }
            return response.status(201).send({
                status: true,
                message: "OTP Send Successfully",
                SMSStatus: SMSStatus,
                data: {
                    smsStatus: sms
                }
            });
        } catch (e) {
            return response.status(400).send({
                status: false,
                message: "Unable to verify Otp"
            })
        }
    }

    //User Education -profile
    async addUserEducation({request, response}) {
        const rules = {
            user_id: 'required',
            school: 'required',
            degree: 'required',
            field: 'required',
            marks: 'required',
            start_date: 'required',
            end_date: 'required'
        };
        const validation = await this.validate(request, response, rules);
        if (validation.fails()) {
            return response.status(422).send({
                status: false,
                message: validation.messages()[0].message,
                hint: validation.messages()
            })
        }
        try {
            const inputs = request.only(["user_id", "school", "degree", "field", "start_date", "end_date", "description","marks"])
            const detail = await UserEducation.create(inputs);
            return response.status(200).json({
                status: true,
                message: "User-Education added Successfully"
            });
        } catch (e) {
            return response.status(400).json({
                status: true,
                message: "Something went wrong!"
            });
        }
    }
    async userEducationListById({ response,params }) {
        try {
            let data = await UserEducation.query()
                .where({'id':params.id})
                .fetch();
            return response.status(200).send({
                status: true,
                message: "User Education List By Id",
                data: data
            });
        }catch (error){
            return response.status(400).send({
                status:false,
                message:`Something Went Wrong!`
            })
        }
    }
    async updateUserEducation({ request, response }) {
        const rules={
            school: 'required',
            degree: 'required',
            field: 'required',
            start_date: 'required',
            marks: 'required',
            end_date: 'required'
        };
        const validation = await this.validate(request, response, rules);
        if (validation.fails()) {
            return response.status(422).send({
                status: false,
                message: validation.messages()[0].message,
                hint: validation.messages()
            })
        }
        try {
            const inputs = request.only(['school', 'degree', 'field', 'start_date', 'end_date', 'description','marks'])
            await UserEducation.query()
                .where('id', request.input("id"))
                .update(inputs);
            return response.status(200).json({
                status: true,
                message: "User Education Updated Successfully"
            });
        }catch (e) {
            return response.status(400).json({
                status: false,
                message: "Something Went Wrong!"
            });
        }
    }
    async deleteUserEducation({ request, response }){
        await UserEducation.query().where({id: request.input('id')}).delete();
        return response.status(200).send({
            status:true,
            message:'User Education record deleted Successfully'
        })
    }

    //update User Experience
    async addUserExperience({request, response}) {
        const rules = {
            user_id: 'required',
            title: 'required',
            employment_type: 'required',
            organisation: 'required',
            company_location: 'required',
            start_date: 'required',
            end_date: 'required'
        };
        const validation = await this.validate(request, response, rules);
        if (validation.fails()) {
            return response.status(422).send({
                status: false,
                message: validation.messages()[0].message,
                hint: validation.messages()
            })
        }
        try {
            const inputs = request.only(["user_id", "title", "employment_type", "organisation", "company_location", "description", "start_date", "end_date"])
            const detail = await UserExperience.create(inputs);
            return response.status(200).json({
                status: true,
                message: "User Experience added Successfully"
            });
        } catch (e) {
            return response.status(400).json({
                status: true,
                message: "Something went wrong!"
            });
        }
    }
    async userExperienceListById({ response,params }) {
        try {
            let data = await UserExperience.query()
                .where({'id':params.id})
                .fetch();
            return response.status(200).send({
                status: true,
                message: "User Experience List By Id",
                data: data
            });
        }catch (error){
            return response.status(400).send({
                status:false,
                message:`Something Went Wrong!`
            })
        }
    }
    async updateUserExperience({ request, response }) {
        const rules = {
            id: 'required',
            title: 'required',
            employment_type: 'required',
            organisation: 'required',
            company_location: 'required',
            start_date: 'required',
            end_date: 'required'
        };
        const validation = await this.validate(request, response, rules);
        if (validation.fails()) {
            return response.status(422).send({
                status: false,
                message: validation.messages()[0].message,
                hint: validation.messages()
            })
        }
        try {
            const inputs = request.only(["title", "employment_type", "organisation", "company_location", "description", "start_date", "end_date"])
            await UserExperience.query()
                .where('id', request.input("id"))
                .update(inputs);
            return response.status(200).json({
                status: true,
                message: "User Experience Updated Successfully"
            });
        }catch (e) {
            return response.status(400).json({
                status: false,
                message: "Something went wrong!"
            });
        }
    }
    async deleteUserExperience({ request, response }){
        await UserExperience.query().where({id: request.input('id')}).delete();
        return response.status(200).send({
            status:true,
            message:'User Experience record deleted Successfully'
        })
    }

    //update User Certification
    async addUserCertification({request, response}) {
        const rules = {
            user_id: 'required',
            name: 'required',
            issued_by: 'required',
            issue_date: 'required',
            expiration_date: 'required',
            credential_id: 'required'
        };
        const validation = await this.validate(request, response, rules);
        if (validation.fails()) {
            return response.status(422).send({
                status: false,
                message: validation.messages()[0].message,
                hint: validation.messages()
            })
        }
        try {
            const inputs = request.only(["user_id", "name", "issued_by", "issue_date", "expiration_date", "credential_id", "credential_url"])
            await UserCertification.create(inputs);
            return response.status(200).json({
                status: true,
                message: "User Certification added Successfully"
            });
        } catch (e) {
            return response.status(400).json({
                status: true,
                message: "Something went wrong!"
            });
        }
    }
    async userCertificationListById({ response,params }) {
        try {
            let data = await UserCertification.query()
                .where({'id':params.id})
                .fetch();
            return response.status(200).send({
                status: true,
                message: "User Certification List By Id",
                data: data
            });
        }catch (error){
            return response.status(400).send({
                status:false,
                message:`Something Went Wrong!`
            })
        }
    }
    async updateUserCertification({ request, response }) {
        const rules = {
            id: 'required',
            name: 'required',
            issued_by: 'required',
            issue_date: 'required',
            expiration_date: 'required',
            credential_id: 'required'
        };
        const validation = await this.validate(request, response, rules);
        if (validation.fails()) {
            return response.status(422).send({
                status: false,
                message: validation.messages()[0].message,
                hint: validation.messages()
            })
        }
        try {
            const inputs = request.only(["name", "issued_by", "issue_date", "expiration_date", "credential_id", "credential_url"])
            await UserCertification.query()
                .where('id', request.input("id"))
                .update(inputs);
            return response.status(200).json({
                status: true,
                message: "User Certification Updated Successfully"
            });
        }catch (e) {
            return response.status(400).json({
                status: false,
                message: "Something went wrong!"
            });
        }
    }
    async deleteUserCertification({ request, response }){
        await UserCertification.query().where({id: request.input('id')}).delete();
        return response.status(200).send({
            status:true,
            message:'User Certification record deleted Successfully'
        })
    }

    //add User Achievements
    async addUserAchievements({request, response}) {
        const rules = {
            user_id: 'required',
            name: 'required',
            issued_by: 'required',
            issue_date: 'required'
        };
        const validation = await this.validate(request, response, rules);
        if (validation.fails()) {
            return response.status(422).send({
                status: false,
                message: validation.messages()[0].message,
                hint: validation.messages()
            })
        }
        try {
            const inputs = request.only(["user_id", "name", "issued_by", "issue_date", "description"])
            await UserAchievement.create(inputs);
            return response.status(200).json({
                status: true,
                message: "User Achievement added Successfully"
            });
        } catch (e) {
            return response.status(400).json({
                status: true,
                message: "Something went wrong!"
            });
        }
    }
    async userAchievementsListById({ response,params }) {
        try {
            let data = await UserAchievement.query()
                .where({'id':params.id})
                .fetch();
            return response.status(200).send({
                status: true,
                message: "User Achievement List By Id",
                data: data
            });
        }catch (error){
            return response.status(400).send({
                status:false,
                message:`Something Went Wrong!`
            })
        }
    }
    async updateUserAchievements({ request, response }) {
        const rules = {
            id: 'required',
            name: 'required',
            issued_by: 'required',
            issue_date: 'required'
        };
        const validation = await this.validate(request, response, rules);
        if (validation.fails()) {
            return response.status(422).send({
                status: false,
                message: validation.messages()[0].message,
                hint: validation.messages()
            })
        }
        try {
            const inputs = request.only(["name", "issued_by", "issue_date", "description"])
            await UserAchievement.query()
                .where('id', request.input("id"))
                .update(inputs);
            return response.status(200).json({
                status: true,
                message: "User Achievement Updated Successfully"
            });
        }catch (e) {
            return response.status(400).json({
                status: false,
                message: "Something went wrong!"
            });
        }
    }
    async deleteUserAchievements({ request, response }){
        await UserAchievement.query().where({id: request.input('id')}).delete();
        return response.status(200).send({
            status:true,
            message:'User Achievement record deleted Successfully'
        })
    }

    //update User Project
    async addUserProject({request, response}) {
        const rules = {
            user_id: 'required',
            title: 'required',
            description: 'required'
        };
        const validation = await this.validate(request, response, rules);
        if (validation.fails()) {
            return response.status(422).send({
                status: false,
                message: validation.messages()[0].message,
                hint: validation.messages()
            })
        }
        try {
            const inputs = request.only(["user_id", "title", "link", "description"])
            await UserProject.create(inputs);
            return response.status(200).json({
                status: true,
                message: "User Project added Successfully"
            });
        } catch (e) {
            return response.status(400).json({
                status: true,
                message: "Something went wrong!"
            });
        }
    }
    async userProjectListById({ response,params }) {
        try {
            let data = await UserProject.query()
                .where({'id':params.id})
                .fetch();
            return response.status(200).send({
                status: true,
                message: "User Project List By Id",
                data: data
            });
        }catch (error){
            return response.status(400).send({
                status:false,
                message:`Something Went Wrong!`
            })
        }
    }
    async updateUserProject({ request, response }) {
        const rules = {
            id: 'required',
            title: 'required',
            description: 'required'
        };
        const validation = await this.validate(request, response, rules);
        if (validation.fails()) {
            return response.status(422).send({
                status: false,
                message: validation.messages()[0].message,
                hint: validation.messages()
            })
        }
        try {
            const inputs = request.only(["title", "link", "description"])
            await UserProject.query()
                .where('id', request.input("id"))
                .update(inputs);
            return response.status(200).json({
                status: true,
                message: "User Project Updated Successfully"
            });
        }catch (e) {
            return response.status(400).json({
                status: false,
                message: "Something went wrong!"
            });
        }
    }
    async deleteUserProject({ request, response }){
        await UserProject.query().where({id: request.input('id')}).delete();
        return response.status(200).send({
            status:true,
            message:'User Project record deleted Successfully'
        })
    }

    //Add Position of Responsibility
    async addUserPositionOfRes({request, response}) {
        const rules = {
            user_id: 'required',
            position: 'required',
            organisation: 'required',
            start_date: 'required',
            end_date: 'required'
        };
        const validation = await this.validate(request, response, rules);
        if (validation.fails()) {
            return response.status(422).send({
                status: false,
                message: validation.messages()[0].message,
                hint: validation.messages()
            })
        }
        try {
            const inputs = request.only(["user_id", "position", "organisation", "start_date", "end_date", "responsibilities"])
            await PositionOfResponsibility.create(inputs);
            return response.status(200).json({
                status: true,
                message: "Position Of Responsibility added Successfully"
            });
        } catch (e) {
            return response.status(400).json({
                status: true,
                message: "Something went wrong!"
            });
        }
    }
    async positionOfResListById({ response,params }) {
        try {
            let data = await PositionOfResponsibility.query()
                .where({'id':params.id})
                .fetch();
            return response.status(200).send({
                status: true,
                message: "Position Of Responsibility List By Id",
                data: data
            });
        }catch (error){
            return response.status(400).send({
                status:false,
                message:`Something Went Wrong!`
            })
        }
    }
    async updatePositionOfRes({ request, response }) {
        const rules = {
            id: 'required',
            position: 'required',
            organisation: 'required',
            start_date: 'required',
            end_date: 'required'
        };
        const validation = await this.validate(request, response, rules);
        if (validation.fails()) {
            return response.status(422).send({
                status: false,
                message: validation.messages()[0].message,
                hint: validation.messages()
            })
        }
        try {
            const inputs = request.only(["position", "organisation", "start_date", "end_date", "responsibilities"])
            await PositionOfResponsibility.query()
                .where('id', request.input("id"))
                .update(inputs);
            return response.status(200).json({
                status: true,
                message: "Position Of Responsibility Updated Successfully"
            });
        }catch (e) {
            return response.status(400).json({
                status: false,
                message: "Something went wrong!"
            });
        }
    }
    async deletePositionOfRes({ request, response }){
        await PositionOfResponsibility.query().where({id: request.input('id')}).delete();
        return response.status(200).send({
            status:true,
            message:'Position Of Responsibility record deleted Successfully'
        })
    }

    //update Profile pending
    async updateUserProfile({request, response, auth}) {
        let rules = {
            first_name: 'string',
            last_name: 'string',
            alt_mobile_no: 'number',
            email: 'string',
            date_of_birth: 'string',
            gender: 'in:MALE,FEMALE,OTHERS',
            about: 'string',
            common_address_line_1: "string",
            website: 'string',
            portfolio: 'string',
            linkedin: 'string'
        }
        const validation = await this.validate(request, response, rules);
        if (validation.fails()) {
            return response.status(422).send({
                status: false,
                message: validation.messages()[0].message,
                hint: validation.messages()
            })
        }
        try {
            const data = request.only(['first_name','last_name', 'alt_mobile_no', 'email', 'date_of_birth', 'gender', 'about', 'common_address_line_1',
                'website', 'portfolio', 'linkedin','profile_image']);
            let id=(auth.user.user_type == 'ADMIN') ? request.input('user_id') : auth.user.id;
            await User.query().where({ id: id}).update(data);
            return response.status(200).send({
                status: true,
                message: "User detail updated successfully",
            })
        }catch (e) {
            return response.status(400).send({
                status: true,
                message: "Something went wrong!"
            })
        }
    }

    async updateUserSkills({ request, response }){
        await User.query().where('id',request.input("user_id")).update({'skills': request.input("skills")});
        return response.status(200).send({
            status:true,
            message:'Successfully updated skills'
        })
    }
    async updateUserIndustryDomain({ request, response }){
        const rules = {
            user_id: 'required',
            area_of_experties: 'required',
            industry: 'required'
        };
        const validation = await this.validate(request, response, rules);
        if (validation.fails()) {
            return response.status(422).send({
                status: false,
                message: validation.messages()[0].message,
                hint: validation.messages()
            })
        }
        try{
            let {user_id,area_of_experties,industry}=request.all();
            const exists = await UserProfile.findBy({user_id: user_id});
            if (area_of_experties) {
                let _t = area_of_experties;
                if (!Array.isArray(_t)) _t = [_t]
                area_of_experties = _t.join();
            }
            if (!exists) {
                await UserProfile.create({'user_id':user_id,'area_of_experties':area_of_experties,'industry':industry});
            } else {
                await UserProfile.query().where('user_id', user_id).update({'area_of_experties':area_of_experties,'industry':industry});
            }
            return response.status(200).send({
                status:true,
                message:'Successfully updated skills'
            })
        }catch (e) {
            return response.status(400).json({
                status: true,
                message: "Something went wrong!"
            });
        }
    }

    async updateUserCategories({ request, response }){
        const rules = {
            user_id: 'required',
            user_categories: 'required'
        };
        const validation = await this.validate(request, response, rules);
        if (validation.fails()) {
            return response.status(422).send({
                status: false,
                message: validation.messages()[0].message,
                hint: validation.messages()
            })
        }
        try{
            let {user_id,user_categories}=request.all();
            if (user_categories) {
                let _t = user_categories;
                if (!Array.isArray(_t)) _t = [_t]
                user_categories = _t.join();
            }
            await User.query().where('id', user_id).update({'user_categories':user_categories});
            return response.status(200).send({
                status:true,
                message:'Successfully updated user categories'
            })
        }catch (e) {
            return response.status(400).json({
                status: true,
                message: "Something went wrong!"
            });
        }
    }

    async addStartup({request, response}) {
        const rules = {
            user_id: 'required',
            startup_name: 'required',
            funding_type: 'required',
            startup_stage: 'required'
        };
        const validation = await this.validate(request, response, rules);
        if (validation.fails()) {
            return response.status(422).send({
                status: false,
                message: validation.messages()[0].message,
                hint: validation.messages()
            })
        }
        try {
            const inputs = request.only(["user_id", "startup_name", "website","funding_type","startup_stage","description","profile_image"])
            await UserStartup.create(inputs);

            return response.status(200).json({
                status: true,
                message: "User startup added Successfully"
            });
        } catch (e) {
            return response.status(400).json({
                status: true,
                message: "Something went wrong!"
            });
        }
    }

    async startupListById({ response,params }) {
        try {
            let data = await UserStartup.query()
                .where({'id':params.id})
                .fetch();
            return response.status(200).send({
                status: true,
                message: "User Startup List By Id",
                data: data
            });
        }catch (error){
            return response.status(400).send({
                status:false,
                message:`Something Went Wrong!`
            })
        }
    }

    async updateStartup({ request, response }) {
        const rules = {
            id: 'required',
            startup_name: 'required',
            funding_type: 'required',
            startup_stage: 'required'
        };
        const validation = await this.validate(request, response, rules);
        if (validation.fails()) {
            return response.status(422).send({
                status: false,
                message: validation.messages()[0].message,
                hint: validation.messages()
            })
        }
        try {
            const inputs = request.only(["startup_name", "website","funding_type","startup_stage","description","profile_image"])
            await UserStartup.query()
                .where('id', request.input("id"))
                .update(inputs);
            return response.status(200).json({
                status: true,
                message: "User Startup Updated Successfully"
            });
        }catch (e) {
            return response.status(400).json({
                status: false,
                message: "Something went wrong!"
            });
        }
    }

    async deleteUserStartup({ request, response }){
        await UserStartup.query().where({id: request.input('id')}).delete();
        return response.status(200).send({
            status:true,
            message:'User startup record deleted Successfully'
        })
    }




    async addStartupCategory({request, response}) {
        const rules = {
            user_id: 'required',
            industry: 'required',
            domain: 'required',
            services: 'required'
        };
        const validation = await this.validate(request, response, rules);
        if (validation.fails()) {
            return response.status(422).send({
                status: false,
                message: validation.messages()[0].message,
                hint: validation.messages()
            })
        }
        try {
            const inputs = request.only(["user_id", "industry", "domain", "aadhaar_number","services","identity"])
            const result = await UserStartupCategory.create(inputs);

            return response.status(200).json({
                status: true,
                message: "User startup category added Successfully",
                data:result
            });
        } catch (e) {
            return response.status(400).json({
                status: true,
                message: "Something went wrong!"
            });
        }
    }

    async startupCategoryListById({ response,params }) {
        try {
            let data = await UserStartupCategory.query()
                .where({'id':params.id})
                .fetch();
            return response.status(200).send({
                status: true,
                message: "User startup category List By Id",
                data: data
            });
        }catch (error){
            return response.status(400).send({
                status:false,
                message:`Something Went Wrong!`
            })
        }
    }

    async updateStartupCategory({ request, response }) {
        const rules = {
            id: 'required',
            industry: 'required',
            domain: 'required',
            services: 'required'
        };
        const validation = await this.validate(request, response, rules);
        if (validation.fails()) {
            return response.status(422).send({
                status: false,
                message: validation.messages()[0].message,
                hint: validation.messages()
            })
        }
        try {
            const inputs = request.only(["user_id", "industry", "domain", "aadhaar_number","services","identity"])
            await UserStartupCategory.query()
                .where('id', request.input("id"))
                .update(inputs);
            return response.status(200).json({
                status: true,
                message: "User startup category Updated Successfully"
            });
        }catch (e) {
            return response.status(400).json({
                status: false,
                message: "Something went wrong!"
            });
        }
    }

    async deleteUserStartupCategory({ request, response }){
        await UserStartupCategory.query().where({id: request.input('id')}).delete();
        return response.status(200).send({
            status:true,
            message:'User startup category record deleted Successfully'
        })
    }
    async uploadFileS3({ request, response }) {
        try {
            let imagePath = null;
            if (request.file('profile_image')) {
                const AssetData = request.file("profile_image", { types: ["image"] });
                let randomstring = Math.random().toString(36).slice(-8);
                let hash = md5(randomstring);
                let documentName = hash + "." + (AssetData.extname).toLowerCase();
                await AssetData.move(Helpers.appRoot() + '/storage/profileimage', { name: documentName, overwrite: false });
                imagePath = '/profileimage/' + documentName;
                if (!AssetData.moved()) return AssetData.error();
                const FileHelper = use('App/utils/FileHelper')
                imagePath = await FileHelper.uploadToPublicS3(Helpers.appRoot() + '/storage/profileimage/' + documentName);
            }

            return response.status(200).json({
                status: true,
                message: "File Uploaded Successfully",
                path: imagePath
            });
        }catch (e) {
            return response.status(400).json({
                status: false,
                message: "Something went wrong!"
            });
        }
    }
}

module.exports = UserController
