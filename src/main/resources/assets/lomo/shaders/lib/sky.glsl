#include frex:shaders/api/header.glsl
#include lomo:shaders/lib/transform.glsl
#include frex:shaders/api/world.glsl
#include frex:shaders/api/view.glsl

struct ray {
	vec3 origin;
	vec3 dir;
};

struct sphere {
	vec3 origin;
	float radius;
};

vec2 ray_sphere_distance(ray r, sphere s) {
	vec3 diff = r.origin - s.origin;

	float a = dot(r.dir, r.dir);
	float b = 2 * dot(diff, r.dir);
	float c = dot(diff, diff) - s.radius * s.radius;

	float d = b*b - 4*a*c;

	if(d >= 0) {
		float xl = (-b - sqrt(d)) / (2.0 * a);
		//if(xl > 0) return xl;

		float xr = (-b + sqrt(d)) / (2.0 * a);
		//if(xr > 0) return xr;
		return vec2(xl, xr);
	}

	return vec2(-1);
}

vec3 hash33(vec3 p3) {
	p3 = fract(p3 * vec3(.1031, .1030, .0973));
	p3 += dot(p3, p3.yxz+19.19);
	return fract((p3.xxy + p3.yxx)*p3.zyx);
}

mat3 rotate(float angle, vec3 v) {
	float a = angle;
	float c = cos(a);
	float s = sin(a);

	vec3 axis = vec3(normalize(v));
	vec3 temp = vec3((1 - c) * axis);

	mat3 Rotate = mat3(0);
	Rotate[0][0] = c + temp[0] * axis[0];
	Rotate[0][1] = temp[0] * axis[1] + s * axis[2];
	Rotate[0][2] = temp[0] * axis[2] - s * axis[1];

	Rotate[1][0] = temp[1] * axis[0] - s * axis[2];
	Rotate[1][1] = c + temp[1] * axis[1];
	Rotate[1][2] = temp[1] * axis[2] + s * axis[0];

	Rotate[2][0] = temp[2] * axis[0] + s * axis[1];
	Rotate[2][1] = temp[2] * axis[1] - s * axis[0];
	Rotate[2][2] = c + temp[2] * axis[2];

	return Rotate;
}

vec3 sky_color(vec3 dir) {
	float t = frx_skyAngleRadians + 3.14 / 2.0;

	float h = 6400000;

	ray r = ray(vec3(0, h, 0), dir);
	sphere s = sphere(vec3(0), h + 12000);

	float dist = ray_sphere_distance(r, s)[1];

	if(dist <= 0) {
		return vec3(0);
	}

	mat3 sun_rot_mat = rotate(t, vec3(0, 0, 1));

	vec3 sun = sun_rot_mat * vec3(1, 0, 0);
	float cos0 = dot(sun, dir);
	float angle = acos(cos0);
	angle -= 0.05;
	if(angle <= 0.001) angle = 0.001;
	angle *= 1 / 0.95;

	r.origin.y += 11000;
	r.dir = sun;
	float sun_dist = ray_sphere_distance(r, s)[1];

	vec3 color = vec3(0);

	color.r = (1 / ((angle + 0.35)*3.0) + 0.10);// * smoothstep(0.0, 150000, 150000 - dist);
	color.g = (1 / ((angle + 0.87)*1.0) - 0.00);// * smoothstep(0.0, 60000, 60000 - dist);
	color.b = (1 / ((angle + 0.90)*1.0) + 0.15);// * smoothstep(0.0, 40000, 40000 - dist);
	color.r = smoothstep(0.0, 15000000, 15000000 - sun_dist);
	color.g = smoothstep(0.0, 9000000, 9000000 - sun_dist);
	color.b = smoothstep(0.0, 8000000, 8000000 - sun_dist);
	//color *= d;

	dir = rotate(t, vec3(0, 0, -1)) * dir;
	vec3 pos = dir * 5;
	vec3 floored = floor(pos);
	vec3 star_offset = hash33(floored);
	color += smoothstep(0.0, 0.015, 0.015 - length(cross(dir, floored + star_offset))) * smoothstep(0.0, 100000, 100000 - dist);

	return color;
}